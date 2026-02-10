import { create } from "zustand";
import { messages as seedMessages, me, rooms as seedRooms, spaces, users } from "../data/mock";
import { Attachment, Message, NotificationItem, Room } from "../types";

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

interface AppState {
  me: typeof me;
  users: typeof users;
  spaces: typeof spaces;
  rooms: Room[];
  messages: Message[];
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
  selectSpace: (spaceId: string) => void;
  selectRoom: (roomId: string) => void;
  toggleMembers: () => void;
  toggleThread: (rootId?: string | null) => void;
  togglePins: () => void;
  setSearchQuery: (value: string) => void;
  setTheme: (value: "dark" | "light") => void;
  setOnline: (value: boolean) => void;
  dismissNotification: (id: string) => void;
  sendMessage: (payload: { body: string; attachments?: Attachment[]; threadRootId?: string }) => void;
  toggleReaction: (messageId: string, emoji: string) => void;
  togglePin: (messageId: string) => void;
  startReply: (messageId: string) => void;
  clearReply: () => void;
  simulateIncoming: () => void;
  completeOnboarding: () => void;
}

const getRoom = (rooms: Room[], roomId: string) => rooms.find((room) => room.id === roomId);

const pickDefaultRoom = (rooms: Room[], spaceId: string) =>
  rooms.find((room) => room.spaceId === spaceId && room.type === "text") || rooms[0];

const createNotification = (title: string, body: string): NotificationItem => ({
  id: uid("n"),
  title,
  body,
  timestamp: Date.now()
});

export const useAppStore = create<AppState>((set) => ({
  me,
  users,
  spaces,
  rooms: seedRooms,
  messages: seedMessages,
  currentSpaceId: spaces[0].id,
  currentRoomId: seedRooms[0].id,
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
  selectSpace: (spaceId) =>
    set((state) => {
      const target = pickDefaultRoom(state.rooms, spaceId);
      return {
        currentSpaceId: spaceId,
        currentRoomId: target?.id ?? state.currentRoomId,
        replyToId: null,
        threadRootId: null,
        showThread: false
      };
    }),
  selectRoom: (roomId) =>
    set((state) => ({
      currentRoomId: roomId,
      replyToId: null,
      threadRootId: null,
      showThread: false,
      rooms: state.rooms.map((room) =>
        room.id === roomId ? { ...room, unreadCount: 0 } : room
      )
    })),
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
  setOnline: (value) =>
    set((state) => ({
      isOnline: value,
      messages: value
        ? state.messages.map((message) =>
            message.status === "queued" ? { ...message, status: "sent" } : message
          )
        : state.messages
    })),
  dismissNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((notification) => notification.id !== id)
    })),
  sendMessage: ({ body, attachments = [], threadRootId }) =>
    set((state) => {
      const replyToId = state.replyToId ?? undefined;
      const message: Message = {
        id: uid("m"),
        roomId: state.currentRoomId,
        authorId: state.me.id,
        body,
        timestamp: Date.now(),
        reactions: [],
        attachments: attachments.length ? attachments : undefined,
        replyToId,
        threadRootId,
        status: state.isOnline ? "sent" : "queued"
      };
      return {
        messages: [...state.messages, message],
        replyToId: null
      };
    }),
  toggleReaction: (messageId, emoji) =>
    set((state) => ({
      messages: state.messages.map((message) => {
        if (message.id !== messageId) {
          return message;
        }
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
    })),
  togglePin: (messageId) =>
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === messageId ? { ...message, pinned: !message.pinned } : message
      )
    })),
  startReply: (messageId) => set({ replyToId: messageId }),
  clearReply: () => set({ replyToId: null }),
  simulateIncoming: () =>
    set((state) => {
      const otherUsers = state.users.filter((user) => user.id !== state.me.id);
      const randomUser = otherUsers[Math.floor(Math.random() * otherUsers.length)];
      const room = getRoom(state.rooms, state.currentRoomId) ?? state.rooms[0];
      const body = `@${state.me.name} check the latest onboarding tweaks in #welcome.`;
      const message: Message = {
        id: uid("m"),
        roomId: room.id,
        authorId: randomUser.id,
        body,
        timestamp: Date.now(),
        reactions: []
      };
      const mentionHit = body.includes(`@${state.me.name}`);
      return {
        messages: [...state.messages, message],
        rooms: state.rooms.map((r) =>
          r.id === room.id
            ? { ...r, unreadCount: r.unreadCount + (r.id === state.currentRoomId ? 0 : 1) }
            : r
        ),
        notifications: mentionHit
          ? [createNotification(`Mention in #${room.name}`, body), ...state.notifications]
          : state.notifications
      };
    }),
  completeOnboarding: () => set({ onboardingStep: null })
}));
