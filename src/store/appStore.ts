import { create } from "zustand";
import {
  ClientEvent,
  EventType,
  GroupCallEvent,
  GroupCallIntent,
  GroupCallType,
  IndexedDBStore,
  MatrixClient,
  MsgType,
  NotificationCountType,
  Preset,
  RelationType,
  Room as MatrixRoom,
  RoomEvent,
  createClient
} from "matrix-js-sdk";
import { CallFeed } from "matrix-js-sdk/lib/webrtc/callFeed";
import { messages as mockMessages, me as mockMe, rooms as mockRooms, spaces as mockSpaces, users as mockUsers } from "../data/mock";
import { Attachment, Message, NotificationItem, Room, RoomType, Space, User } from "../types";

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

const SESSION_KEY = "fray.matrix.session";
const ROOM_TYPE_EVENT = "com.fray.room_type";

const DEFAULT_SPACE: Space = { id: "all", name: "All Rooms", icon: "M" };

type MatrixStatus = "idle" | "connecting" | "syncing" | "error";

interface MatrixSession {
  baseUrl: string;
  accessToken: string;
  userId: string;
  deviceId: string;
  refreshToken?: string;
}

interface CallState {
  roomId: string | null;
  mode: "voice" | "video" | null;
  joined: boolean;
  micMuted: boolean;
  videoMuted: boolean;
  screenSharing: boolean;
  localStream: MediaStream | null;
  remoteStreams: CallFeed[];
  screenshareStreams: CallFeed[];
  error?: string;
}

interface AppState {
  me: User;
  users: User[];
  spaces: Space[];
  rooms: Room[];
  messagesByRoomId: Record<string, Message[]>;
  currentSpaceId: string;
  currentRoomId: string;
  threadRootId: string | null;
  replyToId: string | null;
  showMembers: boolean;
  showThread: boolean;
  showPins: boolean;
  searchQuery: string;
  theme: "dark" | "light";
  isOnline: boolean;
  onboardingStep: number | null;
  notifications: NotificationItem[];
  matrixClient: MatrixClient | null;
  matrixStatus: MatrixStatus;
  matrixError: string | null;
  matrixSession: MatrixSession | null;
  callState: CallState;
  bootstrapMatrix: () => Promise<void>;
  login: (baseUrl: string, username: string, password: string) => Promise<void>;
  register: (baseUrl: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  selectSpace: (spaceId: string) => void;
  selectRoom: (roomId: string) => void;
  toggleMembers: () => void;
  toggleThread: (rootId?: string | null) => void;
  togglePins: () => void;
  setSearchQuery: (value: string) => void;
  setTheme: (value: "dark" | "light") => void;
  setOnline: (value: boolean) => void;
  dismissNotification: (id: string) => void;
  sendMessage: (payload: { body: string; attachments?: Attachment[]; threadRootId?: string }) => Promise<void>;
  createRoom: (payload: { name: string; type: RoomType; category?: string }) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  togglePin: (messageId: string) => Promise<void>;
  startReply: (messageId: string) => void;
  clearReply: () => void;
  simulateIncoming: () => void;
  completeOnboarding: () => void;
  joinCall: () => Promise<void>;
  leaveCall: () => void;
  toggleMic: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => void;
}

const createNotification = (title: string, body: string): NotificationItem => ({
  id: uid("n"),
  title,
  body,
  timestamp: Date.now()
});

const loadSession = (): MatrixSession | null => {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MatrixSession;
  } catch {
    return null;
  }
};

const saveSession = (session: MatrixSession) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

const clearSession = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
};

const mapMembers = (room: MatrixRoom): User[] =>
  room.getJoinedMembers().map((member) => ({
    id: member.userId,
    name: member.name ?? member.userId,
    avatar: (member.name ?? member.userId).slice(0, 1).toUpperCase(),
    status: "offline",
    roles: [member.powerLevel === 100 ? "Admin" : "Member"]
  }));

const buildSpaceIndex = (client: MatrixClient) => {
  const rooms = client.getRooms();
  const spaceRooms = rooms.filter((room) => room.getType() === "m.space");
  const spaces: Space[] = spaceRooms.length
    ? spaceRooms.map((room) => ({
        id: room.roomId,
        name: room.name || room.roomId,
        icon: (room.name || "S").slice(0, 1).toUpperCase()
      }))
    : [DEFAULT_SPACE];

  const children = new Map<string, Set<string>>();
  spaceRooms.forEach((space) => {
    const childEvents = space.currentState.getStateEvents(EventType.SpaceChild) ?? [];
    childEvents.forEach((event) => {
      const roomId = event.getStateKey();
      if (!roomId) return;
      if (!children.has(space.roomId)) {
        children.set(space.roomId, new Set());
      }
      children.get(space.roomId)!.add(roomId);
    });
  });

  return { spaces, children };
};

const getDirectRoomIds = (client: MatrixClient) => {
  const directEvent = client.getAccountData(EventType.Direct);
  const content = directEvent?.getContent() ?? {};
  const directRoomIds = new Set<string>();
  Object.values(content).forEach((rooms) => {
    if (Array.isArray(rooms)) {
      rooms.forEach((roomId) => directRoomIds.add(roomId));
    }
  });
  return directRoomIds;
};

const mapMatrixRoom = (
  client: MatrixClient,
  room: MatrixRoom,
  spaceId: string,
  directRoomIds: Set<string>
): Room => {
  const typeEvent = room.currentState.getStateEvents(ROOM_TYPE_EVENT, "");
  const mappedType = typeEvent?.getContent()?.type as RoomType | undefined;
  const isDm = directRoomIds.has(room.roomId);
  const tags = Object.keys(room.tags ?? {});
  const category = tags[0] ?? "channels";
  const type: RoomType = isDm ? "dm" : mappedType ?? "text";
  const topicEvent = room.currentState.getStateEvents(EventType.RoomTopic, "");
  const topic = topicEvent?.getContent()?.topic ?? "";

  return {
    id: room.roomId,
    spaceId,
    name: room.name || room.getDefaultRoomName(client.getUserId() ?? "") || room.roomId,
    type,
    category,
    topic,
    unreadCount: room.getUnreadNotificationCount
      ? room.getUnreadNotificationCount(NotificationCountType.Total)
      : 0
  };
};

const mapEventsToMessages = (client: MatrixClient, room: MatrixRoom): Message[] => {
  const timelineEvents = room.getLiveTimeline().getEvents();
  const reactionsByEvent = new Map<string, Map<string, string[]>>();

  timelineEvents.forEach((event) => {
    if (event.getType() !== "m.reaction") return;
    const relates = event.getContent()?.["m.relates_to"];
    if (!relates?.event_id || !relates?.key) return;
    const bucket = reactionsByEvent.get(relates.event_id) ?? new Map();
    const users = bucket.get(relates.key) ?? [];
    users.push(event.getSender() ?? "");
    bucket.set(relates.key, users);
    reactionsByEvent.set(relates.event_id, bucket);
  });

  const pinnedEvent = room.currentState.getStateEvents(EventType.RoomPinnedEvents, "");
  const pinnedIds = new Set<string>(pinnedEvent?.getContent()?.pinned ?? []);

  return timelineEvents
    .filter((event) => event.getType() === "m.room.message")
    .filter((event) => !event.isRedacted())
    .map((event) => {
      const content = event.getContent() ?? {};
      const relates = content["m.relates_to"] ?? {};
      const replyToId = relates?.["m.in_reply_to"]?.event_id ?? undefined;
      const threadRootId =
        relates?.rel_type === "m.thread" && typeof relates.event_id === "string"
          ? relates.event_id
          : undefined;
      const attachments: Attachment[] = [];

      if (content.msgtype === "m.image" || content.msgtype === "m.file") {
        const url = content.url
          ? client.mxcUrlToHttp(content.url, 320, 320, "scale") ?? undefined
          : undefined;
        attachments.push({
          id: uid("att"),
          name: content.body ?? "file",
          type: content.msgtype === "m.image" ? "image" : "file",
          size: content.info?.size ?? 0,
          url
        });
      }

      const reactionMap = reactionsByEvent.get(event.getId() ?? "") ?? new Map();
      const reactions = Array.from(reactionMap.entries()).map(([emoji, userIds]) => ({
        emoji,
        userIds
      }));

      return {
        id: event.getId() ?? uid("m"),
        roomId: room.roomId,
        authorId: event.getSender() ?? "",
        body: content.body ?? "",
        timestamp: event.getTs(),
        reactions,
        attachments: attachments.length ? attachments : undefined,
        replyToId,
        threadRootId,
        pinned: pinnedIds.has(event.getId() ?? "")
      };
    });
};

const defaultCallState: CallState = {
  roomId: null,
  mode: null,
  joined: false,
  micMuted: false,
  videoMuted: false,
  screenSharing: false,
  localStream: null,
  remoteStreams: [],
  screenshareStreams: []
};

export const useAppStore = create<AppState>((set, get) => ({
  me: mockMe,
  users: mockUsers,
  spaces: mockSpaces,
  rooms: mockRooms,
  messagesByRoomId: mockRooms.reduce<Record<string, Message[]>>((acc, room) => {
    acc[room.id] = mockMessages.filter((message) => message.roomId === room.id);
    return acc;
  }, {}),
  currentSpaceId: mockSpaces[0]?.id ?? DEFAULT_SPACE.id,
  currentRoomId: mockRooms[0]?.id ?? "",
  threadRootId: null,
  replyToId: null,
  showMembers: true,
  showThread: false,
  showPins: false,
  searchQuery: "",
  theme: "dark",
  isOnline: true,
  onboardingStep: 0,
  notifications: [],
  matrixClient: null,
  matrixStatus: "idle",
  matrixError: null,
  matrixSession: null,
  callState: defaultCallState,
  bootstrapMatrix: async () => {
    if (get().matrixClient) return;
    const session = loadSession();
    if (!session) return;

    set({ matrixStatus: "connecting", matrixSession: session });

    try {
      const store = new IndexedDBStore({ indexedDB: window.indexedDB, dbName: "fray-matrix" });
      await store.startup();
      const client = createClient({
        baseUrl: session.baseUrl,
        accessToken: session.accessToken,
        userId: session.userId,
        deviceId: session.deviceId,
        store,
        timelineSupport: true
      });

      try {
        await client.initRustCrypto();
      } catch (error) {
        console.warn("Rust crypto init failed", error);
      }

      client.on(ClientEvent.Sync, (state) => {
        set({ matrixStatus: state === "SYNCING" ? "syncing" : "idle" });
      });
      client.once(ClientEvent.Sync, (state) => {
        if (state === "PREPARED" || state === "SYNCING") {
          const currentSpace = get().currentSpaceId || DEFAULT_SPACE.id;
          get().selectSpace(currentSpace);
        }
      });

      client.on(RoomEvent.Timeline, (_event, room) => {
        if (!room) return;
        if (room.roomId !== get().currentRoomId) return;
        const messages = mapEventsToMessages(client, room);
        set((state) => ({
          messagesByRoomId: { ...state.messagesByRoomId, [room.roomId]: messages }
        }));
      });

      client.on(RoomEvent.Name, () => {
        get().selectSpace(get().currentSpaceId);
      });
      client.on(RoomEvent.AccountData, () => {
        get().selectSpace(get().currentSpaceId);
      });

      client.startClient({ initialSyncLimit: 30 });

      set({ matrixClient: client, matrixStatus: "syncing", matrixError: null });

      const { spaces } = buildSpaceIndex(client);
      const targetSpaceId = spaces[0]?.id ?? DEFAULT_SPACE.id;
      set({
        spaces,
        currentSpaceId: targetSpaceId,
        currentRoomId: ""
      });

      get().selectSpace(targetSpaceId);
    } catch (error) {
      set({ matrixStatus: "error", matrixError: (error as Error).message });
    }
  },
  login: async (baseUrl, username, password) => {
    set({ matrixStatus: "connecting", matrixError: null });
    const tempClient = createClient({ baseUrl });
    try {
      const response = await tempClient.login("m.login.password", {
        user: username,
        password
      });
      const session: MatrixSession = {
        baseUrl,
        accessToken: response.access_token,
        userId: response.user_id,
        deviceId: response.device_id,
        refreshToken: response.refresh_token
      };
      saveSession(session);
      set({ matrixSession: session });
      await get().bootstrapMatrix();
    } catch (error) {
      set({ matrixStatus: "error", matrixError: (error as Error).message });
    }
  },
  register: async (baseUrl, username, password) => {
    set({ matrixStatus: "connecting", matrixError: null });
    const tempClient = createClient({ baseUrl });
    try {
      const response = await tempClient.register(username, password, null, { type: "m.login.dummy" });
      if (!response.access_token || !response.user_id || !response.device_id) {
        throw new Error("Registration did not return credentials");
      }
      const session: MatrixSession = {
        baseUrl,
        accessToken: response.access_token,
        userId: response.user_id,
        deviceId: response.device_id
      };
      saveSession(session);
      set({ matrixSession: session });
      await get().bootstrapMatrix();
    } catch (error) {
      set({ matrixStatus: "error", matrixError: (error as Error).message });
    }
  },
  logout: async () => {
    const client = get().matrixClient;
    if (client) {
      await client.logout(true).catch(() => undefined);
      client.stopClient();
    }
    clearSession();
    set({
      matrixClient: null,
      matrixSession: null,
      matrixStatus: "idle",
      matrixError: null,
      rooms: mockRooms,
      spaces: mockSpaces,
      users: mockUsers,
      me: mockMe,
      messagesByRoomId: mockRooms.reduce<Record<string, Message[]>>((acc, room) => {
        acc[room.id] = mockMessages.filter((message) => message.roomId === room.id);
        return acc;
      }, {})
    });
  },
  selectSpace: (spaceId) => {
    const client = get().matrixClient;
    if (!client) {
      set((state) => ({
        currentSpaceId: spaceId,
        currentRoomId: state.rooms.find((room) => room.spaceId === spaceId)?.id ?? state.currentRoomId
      }));
      return;
    }

    const { spaces, children } = buildSpaceIndex(client);
    const directRoomIds = getDirectRoomIds(client);
    const availableSpaces = spaces.length ? spaces : [DEFAULT_SPACE];
    const targetSpace = availableSpaces.find((space) => space.id === spaceId) ?? availableSpaces[0];
    const rooms = client
      .getRooms()
      .filter((room) => room.getType() !== "m.space")
      .filter((room) => {
        if (targetSpace.id === DEFAULT_SPACE.id && spaces.length === 0) return true;
        const allowed = children.get(targetSpace.id);
        if (!allowed || allowed.size === 0) return true;
        return allowed.has(room.roomId);
      })
      .map((room) => mapMatrixRoom(client, room, targetSpace.id, directRoomIds));

    const nextRoomId = rooms[0]?.id ?? "";
    set({ spaces: availableSpaces, rooms, currentSpaceId: targetSpace.id, currentRoomId: nextRoomId });

    if (nextRoomId) {
      get().selectRoom(nextRoomId);
    }
  },
  selectRoom: (roomId) => {
    const client = get().matrixClient;
    if (!client) {
      set((state) => ({
        currentRoomId: roomId,
        replyToId: null,
        threadRootId: null,
        showThread: false,
        rooms: state.rooms.map((room) =>
          room.id === roomId ? { ...room, unreadCount: 0 } : room
        )
      }));
      return;
    }

    const room = client.getRoom(roomId);
    if (!room) return;

    const messages = mapEventsToMessages(client, room);
    const members = mapMembers(room);
    const meMember = members.find((member) => member.id === client.getUserId());

    set((state) => ({
      currentRoomId: roomId,
      replyToId: null,
      threadRootId: null,
      showThread: false,
      messagesByRoomId: { ...state.messagesByRoomId, [roomId]: messages },
      users: members,
      me: meMember ?? state.me,
      rooms: state.rooms.map((roomItem) =>
        roomItem.id === roomId ? { ...roomItem, unreadCount: 0 } : roomItem
      )
    }));
  },
  toggleMembers: () => set((state) => ({ showMembers: !state.showMembers })),
  toggleThread: (rootId) =>
    set((state) => {
      if (rootId === null) {
        return { showThread: false, threadRootId: null };
      }
      if (typeof rootId === "string") {
        return { showThread: true, threadRootId: rootId };
      }
      return { showThread: !state.showThread };
    }),
  togglePins: () => set((state) => ({ showPins: !state.showPins })),
  setSearchQuery: (value) => set({ searchQuery: value }),
  setTheme: (value) => set({ theme: value }),
  setOnline: (value) => set({ isOnline: value }),
  dismissNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((notification) => notification.id !== id)
    })),
  sendMessage: async ({ body, attachments = [], threadRootId }) => {
    const client = get().matrixClient;
    const roomId = get().currentRoomId;
    const replyToId = get().replyToId ?? undefined;

    if (!client) {
      set((state) => {
        const message: Message = {
          id: uid("m"),
          roomId,
          authorId: state.me.id,
          body,
          timestamp: Date.now(),
          reactions: [],
          attachments: attachments.length ? attachments : undefined,
          replyToId,
          threadRootId,
          status: state.isOnline ? "sent" : "queued"
        };
        const existing = state.messagesByRoomId[roomId] ?? [];
        return {
          messagesByRoomId: { ...state.messagesByRoomId, [roomId]: [...existing, message] },
          replyToId: null
        };
      });
      return;
    }

    const relates: Record<string, any> = {};
    if (replyToId) {
      relates["m.in_reply_to"] = { event_id: replyToId };
    }
    if (threadRootId) {
      relates.rel_type = "m.thread";
      relates.event_id = threadRootId;
    }

    if (body.trim()) {
      await client.sendEvent(roomId, EventType.RoomMessage, {
        msgtype: MsgType.Text,
        body,
        "m.relates_to": Object.keys(relates).length ? relates : undefined
      });
    }

    for (const attachment of attachments) {
      if (!attachment.file) continue;
      try {
        const upload = await client.uploadContent(attachment.file);
        const contentUri = upload.content_uri as string;
        if (!contentUri) continue;
        if (attachment.type === "image") {
          await client.sendEvent(roomId, EventType.RoomMessage, {
            msgtype: MsgType.Image,
            body: attachment.name,
            url: contentUri,
            info: {
              mimetype: attachment.file.type,
              size: attachment.file.size
            }
          });
        } else {
          await client.sendEvent(roomId, EventType.RoomMessage, {
            msgtype: MsgType.File,
            body: attachment.name,
            url: contentUri,
            info: {
              mimetype: attachment.file.type,
              size: attachment.file.size
            }
          });
        }
      } catch (error) {
        console.warn("Failed to upload attachment", error);
      }
    }

    set({ replyToId: null });
  },
  createRoom: async ({ name, type, category }) => {
    const client = get().matrixClient;
    if (!client) {
      set((state) => {
        const room: Room = {
          id: uid("r"),
          spaceId: state.currentSpaceId,
          name,
          type,
          category: category?.trim() || "channels",
          topic: type === "voice" ? "Drop in voice channel" : type === "video" ? "Video + screen share" : "New text channel",
          unreadCount: 0
        };
        return {
          rooms: [...state.rooms, room],
          currentRoomId: room.id,
          replyToId: null,
          threadRootId: null,
          showThread: false
        };
      });
      return;
    }

    const { room_id } = await client.createRoom({
      name,
      preset: Preset.PublicChat
    });
    await client.sendStateEvent(room_id, ROOM_TYPE_EVENT as any, { type }, "");
    if (category) {
      await client.setRoomTag(room_id, category, { order: 0 });
    }
    get().selectSpace(get().currentSpaceId);
  },
  toggleReaction: async (messageId, emoji) => {
    const client = get().matrixClient;
    if (!client) {
      set((state) => ({
        messagesByRoomId: {
          ...state.messagesByRoomId,
          [state.currentRoomId]: (state.messagesByRoomId[state.currentRoomId] ?? []).map((message) => {
            if (message.id !== messageId) return message;
            const existing = message.reactions.find((reaction) => reaction.emoji === emoji);
            if (!existing) {
              return {
                ...message,
                reactions: [...message.reactions, { emoji, userIds: [state.me.id] }]
              };
            }
            const hasReacted = existing.userIds.includes(state.me.id);
            const updated = hasReacted
              ? existing.userIds.filter((id) => id !== state.me.id)
              : [...existing.userIds, state.me.id];
            const reactions = updated.length
              ? message.reactions.map((reaction) =>
                  reaction.emoji === emoji ? { ...reaction, userIds: updated } : reaction
                )
              : message.reactions.filter((reaction) => reaction.emoji !== emoji);
            return { ...message, reactions };
          })
        }
      }));
      return;
    }

    const room = client.getRoom(get().currentRoomId);
    if (!room) return;
    const existing = room
      .getLiveTimeline()
      .getEvents()
      .find((event) => {
        if (event.getType() !== "m.reaction") return false;
        if (event.getSender() !== client.getUserId()) return false;
        const relates = event.getContent()?.["m.relates_to"];
        return relates?.event_id === messageId && relates?.key === emoji;
      });

    if (existing?.getId()) {
      await client.redactEvent(room.roomId, existing.getId()!);
      return;
    }

    await client.sendEvent(room.roomId, EventType.Reaction, {
      "m.relates_to": {
        rel_type: RelationType.Annotation,
        event_id: messageId,
        key: emoji
      }
    });
  },
  togglePin: async (messageId) => {
    const client = get().matrixClient;
    if (!client) {
      set((state) => ({
        messagesByRoomId: {
          ...state.messagesByRoomId,
          [state.currentRoomId]: (state.messagesByRoomId[state.currentRoomId] ?? []).map((message) =>
            message.id === messageId ? { ...message, pinned: !message.pinned } : message
          )
        }
      }));
      return;
    }

    const room = client.getRoom(get().currentRoomId);
    if (!room) return;
    const pinnedEvent = room.currentState.getStateEvents(EventType.RoomPinnedEvents, "");
    const pinned = new Set<string>(pinnedEvent?.getContent()?.pinned ?? []);
    if (pinned.has(messageId)) {
      pinned.delete(messageId);
    } else {
      pinned.add(messageId);
    }
    await client.sendStateEvent(room.roomId, EventType.RoomPinnedEvents, { pinned: Array.from(pinned) }, "");
    const messages = mapEventsToMessages(client, room);
    set((state) => ({
      messagesByRoomId: { ...state.messagesByRoomId, [room.roomId]: messages }
    }));
  },
  startReply: (messageId) => set({ replyToId: messageId }),
  clearReply: () => set({ replyToId: null }),
  simulateIncoming: () =>
    set((state) => {
      const body = `@${state.me.name} check the latest onboarding tweaks in #welcome.`;
      const message: Message = {
        id: uid("m"),
        roomId: state.currentRoomId,
        authorId: state.users[0]?.id ?? state.me.id,
        body,
        timestamp: Date.now(),
        reactions: []
      };
      const mentionHit = body.includes(`@${state.me.name}`);
      const existing = state.messagesByRoomId[state.currentRoomId] ?? [];
      return {
        messagesByRoomId: {
          ...state.messagesByRoomId,
          [state.currentRoomId]: [...existing, message]
        },
        rooms: state.rooms.map((room) =>
          room.id === state.currentRoomId ? { ...room, unreadCount: room.unreadCount + 1 } : room
        ),
        notifications: mentionHit
          ? [createNotification(`Mention in #${state.currentRoomId}`, body), ...state.notifications]
          : state.notifications
      };
    }),
  completeOnboarding: () => set({ onboardingStep: null }),
  joinCall: async () => {
    const client = get().matrixClient;
    const roomId = get().currentRoomId;
    if (!client) return;

    const room = client.getRoom(roomId);
    if (!room) return;

    const roomType = get().rooms.find((r) => r.id === roomId)?.type;
    const mode = roomType === "video" ? "video" : roomType === "voice" ? "voice" : null;
    if (!mode) return;

    await client.waitUntilRoomReadyForGroupCalls(roomId);

    let call = client.getGroupCallForRoom(roomId);
    if (!call) {
      call = await client.createGroupCall(
        roomId,
        mode === "video" ? GroupCallType.Video : GroupCallType.Voice,
        false,
        GroupCallIntent.Room
      );
    }

    call.on(GroupCallEvent.UserMediaFeedsChanged, (feeds) => {
      set((state) => ({
        callState: {
          ...state.callState,
          remoteStreams: feeds.filter((feed) => feed.userId !== client.getUserId())
        }
      }));
    });
    call.on(GroupCallEvent.ScreenshareFeedsChanged, (feeds) => {
      set((state) => ({
        callState: {
          ...state.callState,
          screenshareStreams: feeds
        }
      }));
    });
    call.on(GroupCallEvent.LocalScreenshareStateChanged, (enabled) => {
      set((state) => ({
        callState: {
          ...state.callState,
          screenSharing: enabled
        }
      }));
    });
    call.on(GroupCallEvent.LocalMuteStateChanged, (micMuted, videoMuted) => {
      set((state) => ({
        callState: {
          ...state.callState,
          micMuted,
          videoMuted
        }
      }));
    });

    await call.enter();

    const localFeed = call.localCallFeed;
    set({
      callState: {
        roomId,
        mode,
        joined: true,
        micMuted: call.isMicrophoneMuted(),
        videoMuted: call.isLocalVideoMuted(),
        screenSharing: call.isScreensharing(),
        localStream: localFeed?.stream ?? null,
        remoteStreams: call.userMediaFeeds ?? [],
        screenshareStreams: call.screenshareFeeds ?? []
      }
    });
  },
  leaveCall: () => {
    const client = get().matrixClient;
    const callState = get().callState;
    if (client && callState.roomId) {
      const call = client.getGroupCallForRoom(callState.roomId);
      call?.leave();
    }
    set({ callState: defaultCallState });
  },
  toggleMic: () => {
    const client = get().matrixClient;
    const callState = get().callState;
    if (!client || !callState.roomId) return;
    const call = client.getGroupCallForRoom(callState.roomId);
    if (!call) return;
    call.setMicrophoneMuted(!callState.micMuted).catch(() => undefined);
  },
  toggleVideo: () => {
    const client = get().matrixClient;
    const callState = get().callState;
    if (!client || !callState.roomId) return;
    const call = client.getGroupCallForRoom(callState.roomId);
    if (!call) return;
    call.setLocalVideoMuted(!callState.videoMuted).catch(() => undefined);
  },
  toggleScreenShare: () => {
    const client = get().matrixClient;
    const callState = get().callState;
    if (!client || !callState.roomId) return;
    const call = client.getGroupCallForRoom(callState.roomId);
    if (!call) return;
    const next = !(callState.screenSharing ?? false);
    call.setScreensharingEnabled(next).catch(() => undefined);
  }
}));
