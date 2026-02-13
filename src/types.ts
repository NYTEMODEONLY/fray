export type RoomType = "text" | "voice" | "video" | "dm";

export type UserStatus = "online" | "idle" | "dnd" | "offline";

export interface User {
  id: string;
  name: string;
  avatar: string;
  avatarUrl?: string;
  status: UserStatus;
  roles: string[];
  roleColor?: string;
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
  system?: boolean;
  status?: "sent" | "queued";
}

export interface Room {
  id: string;
  spaceId: string;
  name: string;
  type: RoomType;
  category?: string;
  sortOrder?: number;
  topic?: string;
  unreadCount: number;
  muted?: boolean;
  isWelcome?: boolean;
}

export interface Category {
  id: string;
  name: string;
  order: number;
}

export interface Space {
  id: string;
  name: string;
  icon: string;
}

export type SafetyLevel = "off" | "members_only" | "strict";

export interface ServerOverviewSettings {
  description: string;
  guidelines: string;
}

export interface ServerRoleSettings {
  adminLevel: number;
  moderatorLevel: number;
  defaultLevel: number;
  definitions?: ServerRoleDefinition[];
  memberRoleIds?: Record<string, string[]>;
}

export type ServerRolePermissionMap = Partial<Record<PermissionAction, boolean>>;

export interface ServerRoleDefinition {
  id: string;
  name: string;
  color: string;
  powerLevel: number;
  permissions?: ServerRolePermissionMap;
}

export interface ServerInviteSettings {
  linkExpiryHours: number;
  requireApproval: boolean;
  allowGuestInvites: boolean;
}

export interface ServerModerationSettings {
  safetyLevel: SafetyLevel;
  blockUnknownMedia: boolean;
  auditLogRetentionDays: number;
}

export interface ServerSettings {
  version: 1;
  overview: ServerOverviewSettings;
  roles: ServerRoleSettings;
  invites: ServerInviteSettings;
  moderation: ServerModerationSettings;
}

export const PERMISSION_ACTIONS = [
  "send",
  "react",
  "pin",
  "redact",
  "invite",
  "manageChannels"
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export type PermissionRule = "inherit" | "allow" | "deny";

export interface PermissionRuleSet {
  send?: PermissionRule;
  react?: PermissionRule;
  pin?: PermissionRule;
  redact?: PermissionRule;
  invite?: PermissionRule;
  manageChannels?: PermissionRule;
}

export interface SpacePermissionOverrides {
  version: 1;
  categories: Record<string, PermissionRuleSet>;
  rooms: Record<string, PermissionRuleSet>;
}

export interface ModerationAuditEvent {
  id: string;
  action: string;
  actorId: string;
  target: string;
  timestamp: number;
  sourceEventId?: string;
}

export type NotificationActionId = "install-update";

export interface NotificationAction {
  id: NotificationActionId;
  label: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  timestamp: number;
  action?: NotificationAction;
}
