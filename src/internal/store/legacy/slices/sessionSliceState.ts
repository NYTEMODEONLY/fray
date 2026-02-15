import type { AppState, AppStateGet, AppStateSet } from "../shared";
import {
  AUDIT_LOG_EVENT,
  ClientEvent,
  DEFAULT_SPACE,
  EventType,
  PERMISSION_OVERRIDES_EVENT,
  RoomEvent,
  SERVER_META_EVENT,
  SERVER_SETTINGS_EVENT,
  SPACE_LAYOUT_EVENT,
  applyProfileToUser,
  applyProfileToUsers,
  buildSpaceIndex,
  clearMatrixSession,
  createSessionMatrixClient,
  defaultCallState,
  defaultMockMessagesByRoomId,
  defaultModerationAuditBySpace,
  defaultPermissionOverridesBySpace,
  defaultRoomLastReadTsByRoomId,
  defaultServerSettingsBySpace,
  getLatestMessageTimestamp,
  getRedactionTargetEventId,
  initialMe,
  initialUsers,
  loadMatrixSession,
  loginWithPassword,
  logoutMatrixClient,
  mapEventsToMessages,
  mockMe,
  mockRooms,
  mockSpaces,
  mockUsers,
  reconcilePendingRedactionsForRoom,
  registerWithPassword,
  resolveSpaceStateHostRoomId,
  resolveTimelineMessages,
  saveMatrixSession,
  startMatrixClient,
  stopMatrixClient
} from "../shared";

export type SessionSliceState = Pick<
  AppState,
  | "me"
  | "users"
  | "matrixClient"
  | "matrixStatus"
  | "matrixError"
  | "matrixSession"
  | "bootstrapMatrix"
  | "login"
  | "register"
  | "logout"
>;

export const createSessionSliceState = (
  set: AppStateSet,
  get: AppStateGet
): SessionSliceState => ({
  me: initialMe,
  users: initialUsers,
  matrixClient: null,
  matrixStatus: "idle",
  matrixError: null,
  matrixSession: null,
  bootstrapMatrix: async () => {
    if (get().matrixClient) return;
    const session = loadMatrixSession();
    if (!session) return;

    set({ matrixStatus: "connecting", matrixSession: session });

    try {
      const client = await createSessionMatrixClient(session);

      client.on(ClientEvent.Sync, (state) => {
        set({ matrixStatus: state === "SYNCING" ? "syncing" : "idle" });
      });
      client.once(ClientEvent.Sync, (state) => {
        if (state === "PREPARED" || state === "SYNCING") {
          const currentSpace = get().currentSpaceId || DEFAULT_SPACE.id;
          get().selectSpace(currentSpace);
        }
      });

      client.on(RoomEvent.Timeline, (event, room) => {
        if (!room) return;
        if (room.roomId !== get().currentRoomId) return;
        reconcilePendingRedactionsForRoom({
          room,
          currentRoomId: get().currentRoomId,
          redactMessage: get().redactMessage
        });
        const eventType = event.getType();
        if (
          eventType !== EventType.RoomMessage &&
          eventType !== EventType.Reaction &&
          eventType !== EventType.RoomRedaction &&
          eventType !== EventType.RoomPinnedEvents
        ) {
          return;
        }
        const redactedEventId =
          eventType === EventType.RoomRedaction ? getRedactionTargetEventId(event) : "";
        const timelineMessages = mapEventsToMessages(client, room);
        set((state) => ({
          messagesByRoomId: {
            ...state.messagesByRoomId,
            [room.roomId]: resolveTimelineMessages({
              existingMessages: state.messagesByRoomId[room.roomId] ?? [],
              timelineMessages,
              removeMessageIds: redactedEventId ? [redactedEventId] : []
            })
          }
        }));
      });

      client.on(RoomEvent.Name, () => {
        get().selectSpace(get().currentSpaceId);
      });
      client.on(RoomEvent.AccountData, () => {
        get().selectSpace(get().currentSpaceId);
      });
      client.on(ClientEvent.Event, (event) => {
        const eventType = event.getType();
        if (
          eventType !== SPACE_LAYOUT_EVENT &&
          eventType !== SERVER_SETTINGS_EVENT &&
          eventType !== SERVER_META_EVENT &&
          eventType !== PERMISSION_OVERRIDES_EVENT &&
          eventType !== AUDIT_LOG_EVENT
        ) {
          return;
        }
        const roomId = event.getRoomId();
        const currentState = get();
        const currentSpaceId = currentState.currentSpaceId;
        const currentStateHostId = resolveSpaceStateHostRoomId(currentState, currentSpaceId);
        if (!roomId || !currentStateHostId || roomId !== currentStateHostId) return;
        get().selectSpace(currentSpaceId);
      });

      startMatrixClient(client);

      set({ matrixClient: client, matrixStatus: "syncing", matrixError: null });

      const { spaces } = buildSpaceIndex(client, DEFAULT_SPACE);
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
    try {
      const session = await loginWithPassword(baseUrl, username, password);
      saveMatrixSession(session);
      set({ matrixSession: session });
      await get().bootstrapMatrix();
    } catch (error) {
      set({ matrixStatus: "error", matrixError: (error as Error).message });
    }
  },
  register: async (baseUrl, username, password) => {
    set({ matrixStatus: "connecting", matrixError: null });
    try {
      const session = await registerWithPassword(baseUrl, username, password);
      saveMatrixSession(session);
      set({ matrixSession: session });
      await get().bootstrapMatrix();
    } catch (error) {
      set({ matrixStatus: "error", matrixError: (error as Error).message });
    }
  },
  logout: async () => {
    const client = get().matrixClient;
    if (client) {
      await logoutMatrixClient(client);
      stopMatrixClient(client);
    }
    clearMatrixSession();
    set({
      matrixClient: null,
      matrixSession: null,
      matrixStatus: "idle",
      matrixError: null,
      showServerSettings: false,
      serverSettingsTab: "overview",
      categoriesBySpaceId: {},
      spaceLayoutsBySpaceId: {},
      spaceStateHostRoomIdBySpaceId: {},
      serverSettingsBySpaceId: defaultServerSettingsBySpace,
      permissionOverridesBySpaceId: defaultPermissionOverridesBySpace,
      moderationAuditBySpaceId: defaultModerationAuditBySpace,
      roomLastReadTsByRoomId: defaultRoomLastReadTsByRoomId,
      threadLastViewedTsByRoomId: {},
      historyLoadingByRoomId: {},
      historyHasMoreByRoomId: {},
      rooms: mockRooms,
      spaces: mockSpaces,
      users: applyProfileToUsers(
        mockUsers,
        mockMe.id,
        get().profileDisplayName,
        get().profileAvatarDataUrl
      ),
      me: applyProfileToUser(
        mockMe,
        get().profileDisplayName,
        get().profileAvatarDataUrl
      ),
      messagesByRoomId: defaultMockMessagesByRoomId,
      currentSpaceId: mockSpaces[0]?.id ?? DEFAULT_SPACE.id,
      currentRoomId: mockRooms[0]?.id ?? "",
      threadRootId: null,
      replyToId: null,
      showThread: false,
      showPins: false,
      callState: defaultCallState
    });
    const firstRoomId = mockRooms[0]?.id ?? "";
    if (firstRoomId) {
      set((state) => ({
        roomLastReadTsByRoomId: {
          ...state.roomLastReadTsByRoomId,
          [firstRoomId]: getLatestMessageTimestamp(state.messagesByRoomId[firstRoomId] ?? [])
        }
      }));
    }
  }
});
