export type RoomType = "text" | "voice" | "video" | "dm";

export type UserStatus = "online" | "idle" | "dnd" | "offline";

export interface User {
  id: string;
  name: string;
  avatar: string;
  status: UserStatus;
  roles: string[];
}

export interface Reaction {
  emoji: string;
  userIds: string[];
}

export interface Attachment {
  id: string;
  name: string;
  type: "image" | "file";
  size: number;
  url?: string;
  file?: File;
}

export interface Message {
  id: string;
  roomId: string;
  authorId: string;
  body: string;
  timestamp: number;
  reactions: Reaction[];
  attachments?: Attachment[];
  replyToId?: string;
  threadRootId?: string;
  pinned?: boolean;
  status?: "sent" | "queued";
}

export interface Room {
  id: string;
  spaceId: string;
  name: string;
  type: RoomType;
  category?: string;
  topic?: string;
  unreadCount: number;
  muted?: boolean;
  isWelcome?: boolean;
}

export interface Space {
  id: string;
  name: string;
  icon: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  timestamp: number;
}
