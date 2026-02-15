import type { StateCreator } from "zustand";
import {
  EventType,
  type CallFeed,
  type MatrixClient,
  type MatrixRoom
} from "../../../matrix/client";
export {
  ClientEvent,
  EventStatus,
  GroupCallEvent,
  GroupCallIntent,
  GroupCallType,
  MatrixEventEvent,
  MsgType,
  Preset,
  RelationType,
  RoomEvent,
  EventType,
  createSessionMatrixClient,
  logoutMatrixClient,
  startMatrixClient,
  stopMatrixClient
} from "../../../matrix/client";
import type { MatrixSession } from "../../../matrix/session";
export {
  clearMatrixSession,
  loadMatrixSession,
  loginWithPassword,
  registerWithPassword,
  saveMatrixSession
} from "../../../matrix/session";
export { buildSpaceIndex, getDirectRoomIds, isRoomDeleted, mapMatrixRoom, mapMembers } from "../../../matrix/rooms";
export { getRedactionTargetEventId, loadRoomMessagesWithBackfill, mapEventsToMessages } from "../../../matrix/timeline";
import { featureFlags } from "../../../config/featureFlags";
import { invoke } from "@tauri-apps/api/core";
import {
  messages as mockMessages,
  me as mockMe,
  rooms as mockRooms,
  spaces as mockSpaces,
  users as mockUsers
} from "../../../data/mock";
export {
  messages as mockMessages,
  me as mockMe,
  rooms as mockRooms,
  spaces as mockSpaces,
  users as mockUsers
} from "../../../data/mock";
import {
  Attachment,
  Category,
  Message,
  ModerationAuditEvent,
  NotificationAction,
  NotificationItem,
  PERMISSION_ACTIONS,
  PermissionAction,
  PermissionRule,
  PermissionRuleSet,
  Room,
  RoomType,
  ServerRoleDefinition,
  ServerSettings,
  Space,
  SpacePermissionOverrides,
  User
} from "../../../types";
export { PERMISSION_ACTIONS } from "../../../types";
export type {
  Attachment,
  Category,
  Message,
  ModerationAuditEvent,
  NotificationAction,
  NotificationItem,
  PermissionAction,
  PermissionRule,
  PermissionRuleSet,
  Room,
  RoomType,
  ServerRoleDefinition,
  ServerSettings,
  Space,
  SpacePermissionOverrides,
  User
} from "../../../types";
import { canDeleteChannelsAndCategories, parsePowerLevels } from "../../../services/permissionService";
export { trackLocalMetricEvent } from "../../../services/localMetricsService";

export const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

export const ROOM_TYPE_EVENT = "com.fray.room_type";
export const PREFERENCES_KEY = "fray.preferences";
export const PENDING_REDACTIONS_KEY = "fray.pending_redactions";
export const SPACE_LAYOUT_EVENT = "com.fray.space_layout";
export const SERVER_SETTINGS_EVENT = "com.fray.server_settings";
export const SERVER_META_EVENT = "com.fray.server_meta";
export const PERMISSION_OVERRIDES_EVENT = "com.fray.permission_overrides";
export const AUDIT_LOG_EVENT = "com.fray.audit_log";
export const DEFAULT_CATEGORY_ID = "channels";
export const DEFAULT_CATEGORY_NAME = "Channels";
export const PENDING_REDACTION_TTL_MS = 24 * 60 * 60 * 1000;
export const PENDING_REDACTION_MAX_ITEMS = 200;

export const DEFAULT_SPACE: Space = { id: "all", name: "All Rooms", icon: "M" };

export const toMembership = (value: string | undefined) => {
  if (value === "join" || value === "invite" || value === "leave" || value === "ban" || value === "knock") {
    return value;
  }
  return "unknown";
};

export type MatrixStatus = "idle" | "connecting" | "syncing" | "error";
export type ServerSettingsTab =
  | "overview"
  | "roles"
  | "members"
  | "channels"
  | "invites"
  | "moderation"
  | "health";

export interface PendingRedactionIntent {
  roomId: string;
  transactionId: string;
  sourceMessageId: string;
  queuedAt: number;
}

export interface CallState {
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

export interface UserPreferences {
  theme: "dark" | "light";
  composerEnterToSend: boolean;
  messageDensity: "cozy" | "compact";
  notificationsEnabled: boolean;
  mentionsOnlyNotifications: boolean;
  keybindsEnabled: boolean;
  composerSpellcheck: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  fontScale: 1 | 1.1 | 1.2;
  onboardingCompleted: boolean;
  profileDisplayName: string;
  profileAbout: string;
  profileAvatarDataUrl: string | null;
}

export interface SpaceLayoutCategory {
  id: string;
  name: string;
  order: number;
}

export interface SpaceLayoutRoom {
  categoryId: string;
  order: number;
}

export interface SpaceLayout {
  version: 1;
  categories: SpaceLayoutCategory[];
  rooms: Record<string, SpaceLayoutRoom>;
}

export interface AppState {
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
  showServerSettings: boolean;
  serverSettingsTab: ServerSettingsTab;
  searchQuery: string;
  composerEnterToSend: boolean;
  messageDensity: "cozy" | "compact";
  notificationsEnabled: boolean;
  mentionsOnlyNotifications: boolean;
  keybindsEnabled: boolean;
  composerSpellcheck: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  fontScale: 1 | 1.1 | 1.2;
  theme: "dark" | "light";
  isOnline: boolean;
  onboardingStep: number | null;
  profileDisplayName: string;
  profileAbout: string;
  profileAvatarDataUrl: string | null;
  notifications: NotificationItem[];
  categoriesBySpaceId: Record<string, Category[]>;
  spaceLayoutsBySpaceId: Record<string, SpaceLayout>;
  spaceStateHostRoomIdBySpaceId: Record<string, string>;
  serverSettingsBySpaceId: Record<string, ServerSettings>;
  permissionOverridesBySpaceId: Record<string, SpacePermissionOverrides>;
  moderationAuditBySpaceId: Record<string, ModerationAuditEvent[]>;
  roomLastReadTsByRoomId: Record<string, number>;
  threadLastViewedTsByRoomId: Record<string, Record<string, number>>;
  historyLoadingByRoomId: Record<string, boolean>;
  historyHasMoreByRoomId: Record<string, boolean>;
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
  openServerSettings: (tab?: ServerSettingsTab) => void;
  closeServerSettings: () => void;
  setServerSettingsTab: (tab: ServerSettingsTab) => void;
  setSearchQuery: (value: string) => void;
  setTheme: (value: "dark" | "light") => void;
  setOnline: (value: boolean) => void;
  dismissNotification: (id: string) => void;
  pushNotification: (title: string, body: string, options?: { action?: NotificationAction }) => void;
  setComposerEnterToSend: (value: boolean) => void;
  setMessageDensity: (value: "cozy" | "compact") => void;
  setNotificationsEnabled: (value: boolean) => void;
  setMentionsOnlyNotifications: (value: boolean) => void;
  setKeybindsEnabled: (value: boolean) => void;
  setComposerSpellcheck: (value: boolean) => void;
  setReducedMotion: (value: boolean) => void;
  setHighContrast: (value: boolean) => void;
  setFontScale: (value: 1 | 1.1 | 1.2) => void;
  setProfileDisplayName: (value: string) => void;
  setProfileAbout: (value: string) => void;
  setProfileAvatarDataUrl: (value: string | null) => void;
  markRoomRead: (roomId?: string) => void;
  sendMessage: (payload: { body: string; attachments?: Attachment[]; threadRootId?: string }) => Promise<void>;
  createRoom: (payload: { name: string; type: RoomType; category?: string }) => Promise<void>;
  deleteRoom: (roomId: string) => Promise<void>;
  createSpace: (name: string) => Promise<void>;
  renameSpace: (spaceId: string, name: string) => Promise<void>;
  saveServerSettings: (spaceId: string, settings: ServerSettings) => Promise<void>;
  setCategoryPermissionRule: (categoryId: string, action: PermissionAction, rule: PermissionRule) => Promise<void>;
  setRoomPermissionRule: (roomId: string, action: PermissionAction, rule: PermissionRule) => Promise<void>;
  createCategory: (name: string) => Promise<void>;
  renameCategory: (categoryId: string, name: string) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  moveCategoryByStep: (categoryId: string, direction: "up" | "down") => Promise<void>;
  reorderCategory: (sourceCategoryId: string, targetCategoryId: string) => Promise<void>;
  moveRoomByStep: (roomId: string, direction: "up" | "down") => Promise<void>;
  moveRoomToCategory: (roomId: string, categoryId: string) => Promise<void>;
  reorderRoom: (sourceRoomId: string, targetRoomId: string, targetCategoryId?: string) => Promise<void>;
  paginateCurrentRoomHistory: () => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  togglePin: (messageId: string) => Promise<void>;
  redactMessage: (messageId: string) => Promise<void>;
  copyMessageLink: (messageId: string) => Promise<void>;
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

export const defaultUserPreferences: UserPreferences = {
  theme: "dark",
  composerEnterToSend: true,
  messageDensity: "cozy",
  notificationsEnabled: true,
  mentionsOnlyNotifications: false,
  keybindsEnabled: true,
  composerSpellcheck: true,
  reducedMotion: false,
  highContrast: false,
  fontScale: 1,
  onboardingCompleted: false,
  profileDisplayName: "",
  profileAbout: "",
  profileAvatarDataUrl: null
};

export const normalizeFontScale = (value: unknown): 1 | 1.1 | 1.2 => {
  if (value === 1.1 || value === 1.2 || value === 1) {
    return value;
  }
  return 1;
};

export const normalizePreferences = (value: Partial<UserPreferences> | null | undefined): UserPreferences => {
  const input = value ?? {};
  const profileAvatarDataUrl =
    typeof input.profileAvatarDataUrl === "string" && input.profileAvatarDataUrl.startsWith("data:image")
      ? input.profileAvatarDataUrl
      : null;
  return {
    theme: input.theme === "light" ? "light" : "dark",
    composerEnterToSend: input.composerEnterToSend ?? defaultUserPreferences.composerEnterToSend,
    messageDensity: input.messageDensity === "compact" ? "compact" : "cozy",
    notificationsEnabled: input.notificationsEnabled ?? defaultUserPreferences.notificationsEnabled,
    mentionsOnlyNotifications:
      input.mentionsOnlyNotifications ?? defaultUserPreferences.mentionsOnlyNotifications,
    keybindsEnabled: input.keybindsEnabled ?? defaultUserPreferences.keybindsEnabled,
    composerSpellcheck: input.composerSpellcheck ?? defaultUserPreferences.composerSpellcheck,
    reducedMotion: input.reducedMotion ?? defaultUserPreferences.reducedMotion,
    highContrast: input.highContrast ?? defaultUserPreferences.highContrast,
    fontScale: normalizeFontScale(input.fontScale),
    onboardingCompleted: input.onboardingCompleted ?? defaultUserPreferences.onboardingCompleted,
    profileDisplayName:
      typeof input.profileDisplayName === "string"
        ? input.profileDisplayName.trim().slice(0, 32)
        : defaultUserPreferences.profileDisplayName,
    profileAbout:
      typeof input.profileAbout === "string"
        ? input.profileAbout.trim().slice(0, 190)
        : defaultUserPreferences.profileAbout,
    profileAvatarDataUrl
  };
};

export const toPreferencesFromState = (
  state: Pick<
    AppState,
    | "composerEnterToSend"
    | "messageDensity"
    | "theme"
    | "notificationsEnabled"
    | "mentionsOnlyNotifications"
    | "keybindsEnabled"
    | "composerSpellcheck"
    | "reducedMotion"
    | "highContrast"
    | "fontScale"
    | "onboardingStep"
    | "profileDisplayName"
    | "profileAbout"
    | "profileAvatarDataUrl"
  >
): UserPreferences => ({
  theme: state.theme,
  composerEnterToSend: state.composerEnterToSend,
  messageDensity: state.messageDensity,
  notificationsEnabled: state.notificationsEnabled,
  mentionsOnlyNotifications: state.mentionsOnlyNotifications,
  keybindsEnabled: state.keybindsEnabled,
  composerSpellcheck: state.composerSpellcheck,
  reducedMotion: state.reducedMotion,
  highContrast: state.highContrast,
  fontScale: state.fontScale,
  onboardingCompleted: state.onboardingStep === null,
  profileDisplayName: state.profileDisplayName,
  profileAbout: state.profileAbout,
  profileAvatarDataUrl: state.profileAvatarDataUrl
});

export const createNotification = (
  title: string,
  body: string,
  options?: { action?: NotificationAction }
): NotificationItem => ({
  id: uid("n"),
  title,
  body,
  timestamp: Date.now(),
  action: options?.action
});

export const loadPreferences = (): UserPreferences => {
  if (typeof window === "undefined") return defaultUserPreferences;
  const raw = localStorage.getItem(PREFERENCES_KEY);
  if (!raw) return defaultUserPreferences;
  try {
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return normalizePreferences(parsed);
  } catch {
    return defaultUserPreferences;
  }
};

export const savePreferences = (preferences: UserPreferences) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
};

export const normalizePendingRedactionIntent = (value: unknown): PendingRedactionIntent | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const roomId = typeof raw.roomId === "string" ? raw.roomId.trim() : "";
  const transactionId = typeof raw.transactionId === "string" ? raw.transactionId.trim() : "";
  const sourceMessageId = typeof raw.sourceMessageId === "string" ? raw.sourceMessageId.trim() : "";
  const queuedAt =
    typeof raw.queuedAt === "number" && Number.isFinite(raw.queuedAt) ? raw.queuedAt : Date.now();
  if (!roomId || !transactionId || !sourceMessageId) return null;
  return { roomId, transactionId, sourceMessageId, queuedAt };
};

export const prunePendingRedactionIntents = (intents: PendingRedactionIntent[]) => {
  const cutoff = Date.now() - PENDING_REDACTION_TTL_MS;
  const dedupe = new Map<string, PendingRedactionIntent>();
  intents
    .filter((intent) => intent.queuedAt >= cutoff)
    .sort((left, right) => right.queuedAt - left.queuedAt)
    .forEach((intent) => {
      const key = `${intent.roomId}::${intent.transactionId}`;
      if (!dedupe.has(key)) {
        dedupe.set(key, intent);
      }
    });
  return Array.from(dedupe.values()).slice(0, PENDING_REDACTION_MAX_ITEMS);
};

export const loadPendingRedactionIntents = (): PendingRedactionIntent[] => {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(PENDING_REDACTIONS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed
      .map((item) => normalizePendingRedactionIntent(item))
      .filter((item): item is PendingRedactionIntent => Boolean(item));
    const pruned = prunePendingRedactionIntents(normalized);
    if (pruned.length !== normalized.length) {
      localStorage.setItem(PENDING_REDACTIONS_KEY, JSON.stringify(pruned));
    }
    return pruned;
  } catch {
    return [];
  }
};

export const savePendingRedactionIntents = (intents: PendingRedactionIntent[]) => {
  if (typeof window === "undefined") return;
  const pruned = prunePendingRedactionIntents(intents);
  if (!pruned.length) {
    localStorage.removeItem(PENDING_REDACTIONS_KEY);
    return;
  }
  localStorage.setItem(PENDING_REDACTIONS_KEY, JSON.stringify(pruned));
};

export const queuePendingRedactionIntent = (intent: PendingRedactionIntent) => {
  const existing = loadPendingRedactionIntents().filter(
    (entry) => !(entry.roomId === intent.roomId && entry.transactionId === intent.transactionId)
  );
  savePendingRedactionIntents([intent, ...existing]);
};

export const removePendingRedactionIntent = (roomId: string, transactionId: string) => {
  const existing = loadPendingRedactionIntents().filter(
    (entry) => !(entry.roomId === roomId && entry.transactionId === transactionId)
  );
  savePendingRedactionIntents(existing);
};

export const getPendingRedactionIntentsForRoom = (roomId: string) =>
  loadPendingRedactionIntents().filter((entry) => entry.roomId === roomId);

export const getLocalEchoTransactionId = (roomId: string, messageId: string) => {
  const localIdPrefix = `~${roomId}:`;
  if (!messageId.startsWith(localIdPrefix)) return null;
  const transactionId = messageId.slice(localIdPrefix.length);
  return transactionId.trim() ? transactionId : null;
};

export const findRemoteEchoEventId = (room: MatrixRoom, transactionId: string) => {
  const remoteEchoEvent = (room.getLiveTimeline?.().getEvents?.() ?? []).find(
    (event) => event.getUnsigned()?.transaction_id === transactionId
  );
  return remoteEchoEvent?.getId() ?? null;
};

export const pendingRedactionIntentKey = (roomId: string, transactionId: string) =>
  `${roomId}::${transactionId}`;

export const pendingRedactionInFlight = new Set<string>();

export const reconcilePendingRedactionsForRoom = ({
  room,
  currentRoomId,
  redactMessage
}: {
  room: MatrixRoom;
  currentRoomId: string;
  redactMessage: (messageId: string) => Promise<void>;
}) => {
  if (room.roomId !== currentRoomId) return;
  const intents = getPendingRedactionIntentsForRoom(room.roomId);
  intents.forEach((intent) => {
    const remoteEchoEventId = findRemoteEchoEventId(room, intent.transactionId);
    if (!remoteEchoEventId || remoteEchoEventId.startsWith("~")) return;
    const key = pendingRedactionIntentKey(intent.roomId, intent.transactionId);
    if (pendingRedactionInFlight.has(key)) return;
    pendingRedactionInFlight.add(key);
    void redactMessage(remoteEchoEventId)
      .finally(() => {
        removePendingRedactionIntent(intent.roomId, intent.transactionId);
        pendingRedactionInFlight.delete(key);
      });
  });
};

export const getAvatarInitial = (name: string) => name.slice(0, 1).toUpperCase() || "?";

export const toDisplayName = (override: string | undefined, fallback: string) => {
  const next = override?.trim();
  return next ? next.slice(0, 32) : fallback;
};

export const applyProfileToUser = (
  user: User,
  profileDisplayName: string,
  profileAvatarDataUrl: string | null
): User => {
  const name = toDisplayName(profileDisplayName, user.name);
  return {
    ...user,
    name,
    avatar: getAvatarInitial(name),
    avatarUrl: profileAvatarDataUrl ?? undefined
  };
};

export const applyProfileToUsers = (
  users: User[],
  meId: string,
  profileDisplayName: string,
  profileAvatarDataUrl: string | null
) =>
  users.map((user) =>
    user.id === meId ? applyProfileToUser(user, profileDisplayName, profileAvatarDataUrl) : user
  );

export const createDefaultLayout = (): SpaceLayout => ({
  version: 1,
  categories: [{ id: DEFAULT_CATEGORY_ID, name: DEFAULT_CATEGORY_NAME, order: 0 }],
  rooms: {}
});

export const createDefaultServerSettings = (): ServerSettings => ({
  version: 1,
  overview: {
    description: "",
    guidelines: ""
  },
  roles: {
    adminLevel: 100,
    moderatorLevel: 50,
    defaultLevel: 0,
    definitions: [],
    memberRoleIds: {}
  },
  invites: {
    linkExpiryHours: 24,
    requireApproval: false,
    allowGuestInvites: true
  },
  moderation: {
    safetyLevel: "members_only",
    blockUnknownMedia: false,
    auditLogRetentionDays: 30
  }
});

export const normalizeRoleDefinitions = (value: unknown): ServerRoleDefinition[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const normalizeRolePermissions = (
    input: unknown
  ): Partial<Record<PermissionAction, boolean>> => {
    if (!input || typeof input !== "object") return {};
    const raw = input as Record<string, unknown>;
    return PERMISSION_ACTIONS.reduce<Partial<Record<PermissionAction, boolean>>>(
      (accumulator, action) => {
        if (typeof raw[action] === "boolean") {
          accumulator[action] = raw[action] as boolean;
        }
        return accumulator;
      },
      {}
    );
  };
  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => item as Record<string, unknown>)
    .map((item) => {
      const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : uid("role");
      const name = typeof item.name === "string" && item.name.trim() ? item.name.trim() : "Role";
      const color = typeof item.color === "string" && /^#[0-9a-fA-F]{6}$/.test(item.color) ? item.color : "#8b93a7";
      const powerLevel =
        typeof item.powerLevel === "number" && Number.isFinite(item.powerLevel)
          ? clampNumber(item.powerLevel, 0, 100)
          : 0;
      const permissions = normalizeRolePermissions(item.permissions);
      return { id, name, color, powerLevel, permissions };
    })
    .filter((role) => {
      if (seen.has(role.id)) return false;
      seen.add(role.id);
      return true;
    });
};

export const normalizeRoleAssignments = (
  value: unknown,
  validRoleIds: Set<string>
): Record<string, string[]> => {
  if (!value || typeof value !== "object") return {};
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string[]>>(
    (accumulator, [userId, rawRoleIds]) => {
      if (!Array.isArray(rawRoleIds)) return accumulator;
      const roleIds = rawRoleIds
        .filter((roleId): roleId is string => typeof roleId === "string")
        .filter((roleId, index, array) => array.indexOf(roleId) === index)
        .filter((roleId) => validRoleIds.has(roleId));
      if (roleIds.length) {
        accumulator[userId] = roleIds;
      }
      return accumulator;
    },
    {}
  );
};

export const applyServerRolesToUsers = (users: User[], settings: ServerSettings): User[] => {
  const roleDefinitions = settings.roles.definitions ?? [];
  const roleNameById = new Map(roleDefinitions.map((role) => [role.id, role.name]));
  const roleById = new Map(roleDefinitions.map((role) => [role.id, role]));
  const memberRoleIds = settings.roles.memberRoleIds ?? {};

  return users.map((user) => {
    const assignedRoleIds = memberRoleIds[user.id] ?? [];
    const customRoleNames = assignedRoleIds
      .map((roleId) => roleNameById.get(roleId))
      .filter((roleName): roleName is string => Boolean(roleName));
    const highestRole = assignedRoleIds
      .map((roleId) => roleById.get(roleId))
      .filter((role): role is ServerRoleDefinition => Boolean(role))
      .sort((left, right) => right.powerLevel - left.powerLevel)[0];
    const mergedRoles = Array.from(new Set([...user.roles, ...customRoleNames]));
    return {
      ...user,
      roles: mergedRoles,
      roleColor: highestRole?.color
    };
  });
};

export const stripServerRolesFromUsers = (users: User[], settings: ServerSettings): User[] => {
  const customRoleNames = new Set((settings.roles.definitions ?? []).map((role) => role.name));
  if (!customRoleNames.size) {
    return users.map((user) => ({
      ...user,
      roleColor: undefined
    }));
  }
  return users.map((user) => ({
    ...user,
    roles: user.roles.filter((role) => !customRoleNames.has(role)),
    roleColor: undefined
  }));
};

export const withAppliedServerRoles = (users: User[], settings: ServerSettings) =>
  applyServerRolesToUsers(stripServerRolesFromUsers(users, settings), settings);

export const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const normalizeServerSettings = (settings: Partial<ServerSettings> | null | undefined): ServerSettings => {
  const defaults = createDefaultServerSettings();
  const input = settings ?? {};
  const roles = (input.roles ?? {}) as Partial<ServerSettings["roles"]>;
  const invites = (input.invites ?? {}) as Partial<ServerSettings["invites"]>;
  const moderation = (input.moderation ?? {}) as Partial<ServerSettings["moderation"]>;
  const overview = (input.overview ?? {}) as Partial<ServerSettings["overview"]>;

  const safetyLevel =
    moderation.safetyLevel === "off" ||
    moderation.safetyLevel === "members_only" ||
    moderation.safetyLevel === "strict"
      ? moderation.safetyLevel
      : defaults.moderation.safetyLevel;
  const roleDefinitions = normalizeRoleDefinitions(roles.definitions);
  const validRoleIds = new Set(roleDefinitions.map((role) => role.id));
  const memberRoleIds = normalizeRoleAssignments(roles.memberRoleIds, validRoleIds);

  return {
    version: 1,
    overview: {
      description: typeof overview.description === "string" ? overview.description : defaults.overview.description,
      guidelines: typeof overview.guidelines === "string" ? overview.guidelines : defaults.overview.guidelines
    },
    roles: {
      adminLevel: clampNumber(
        typeof roles.adminLevel === "number" ? roles.adminLevel : defaults.roles.adminLevel,
        0,
        100
      ),
      moderatorLevel: clampNumber(
        typeof roles.moderatorLevel === "number" ? roles.moderatorLevel : defaults.roles.moderatorLevel,
        0,
        100
      ),
      defaultLevel: clampNumber(
        typeof roles.defaultLevel === "number" ? roles.defaultLevel : defaults.roles.defaultLevel,
        0,
        100
      ),
      definitions: roleDefinitions,
      memberRoleIds
    },
    invites: {
      linkExpiryHours: clampNumber(
        typeof invites.linkExpiryHours === "number"
          ? invites.linkExpiryHours
          : defaults.invites.linkExpiryHours,
        1,
        168
      ),
      requireApproval:
        typeof invites.requireApproval === "boolean"
          ? invites.requireApproval
          : defaults.invites.requireApproval,
      allowGuestInvites:
        typeof invites.allowGuestInvites === "boolean"
          ? invites.allowGuestInvites
          : defaults.invites.allowGuestInvites
    },
    moderation: {
      safetyLevel,
      blockUnknownMedia:
        typeof moderation.blockUnknownMedia === "boolean"
          ? moderation.blockUnknownMedia
          : defaults.moderation.blockUnknownMedia,
      auditLogRetentionDays: clampNumber(
        typeof moderation.auditLogRetentionDays === "number"
          ? moderation.auditLogRetentionDays
          : defaults.moderation.auditLogRetentionDays,
        7,
        365
      )
    }
  };
};

export const getRolePermissionGrant = (
  roleSettings: ServerSettings["roles"],
  userId: string,
  action: PermissionAction
) => {
  const assignedRoleIds = new Set(roleSettings.memberRoleIds?.[userId] ?? []);
  if (!assignedRoleIds.size) return false;
  return (roleSettings.definitions ?? []).some((role) => {
    if (!assignedRoleIds.has(role.id)) return false;
    return role.permissions?.[action] === true;
  });
};

export const canCurrentUserDeleteChannelsInSpace = (
  state: Pick<AppState, "matrixClient" | "me" | "serverSettingsBySpaceId" | "rooms">,
  spaceId: string,
  roomId: string
) => {
  const roleSettings = normalizeServerSettings(state.serverSettingsBySpaceId[spaceId] ?? null).roles;
  if (!state.matrixClient) {
    return true;
  }

  const matrixRoom =
    state.matrixClient.getRoom(roomId) ??
    state.matrixClient.getRoom(
      state.rooms.find((room) => room.spaceId === spaceId && room.type !== "dm")?.id ?? ""
    );
  if (!matrixRoom) {
    return getRolePermissionGrant(roleSettings, state.me.id, "manageChannels");
  }

  const powerLevelContent = matrixRoom.currentState.getStateEvents(EventType.RoomPowerLevels, "")?.getContent();
  const powerLevels = parsePowerLevels(powerLevelContent);
  const membership = toMembership(matrixRoom.getMember(state.me.id)?.membership);

  return canDeleteChannelsAndCategories({
    userId: state.me.id,
    membership,
    powerLevels,
    roleSettings
  });
};

export const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, "");

export const readErrorBody = async (response: Response) => {
  const text = await response.text().catch(() => "");
  if (!text) return `HTTP ${response.status}`;
  try {
    const parsed = JSON.parse(text) as { error?: string };
    if (typeof parsed.error === "string" && parsed.error.trim()) {
      return `${response.status}: ${parsed.error}`;
    }
  } catch {
    // Ignore JSON parse errors and return raw text.
  }
  return `${response.status}: ${text}`;
};

export const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });

export interface SynapseDeleteRequest {
  baseUrl: string;
  accessToken: string;
  roomId: string;
  requesterUserId: string;
}

export interface SynapseDeleteStatus {
  status?: string;
  error?: string;
}

export const hasTauriRuntime = () => {
  if (typeof window === "undefined") return false;
  return typeof (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== "undefined";
};

export const parseSynapseDeleteStatus = (payload: unknown, deleteId: string): SynapseDeleteStatus => {
  if (!payload || typeof payload !== "object") {
    return {};
  }
  const content = payload as Record<string, unknown>;
  const status = typeof content.status === "string" ? content.status : undefined;
  const directError = typeof content.error === "string" ? content.error : undefined;
  if (status) {
    const shutdown = content.shutdown_room;
    const shutdownError =
      shutdown && typeof shutdown === "object" && typeof (shutdown as Record<string, unknown>).error === "string"
        ? ((shutdown as Record<string, unknown>).error as string)
        : undefined;
    return {
      status,
      error: directError ?? shutdownError
    };
  }

  const results = Array.isArray(content.results) ? content.results : [];
  const matchingEntry =
    results.find((item) => {
      if (!item || typeof item !== "object") return false;
      return (item as Record<string, unknown>).delete_id === deleteId;
    }) ??
    results.find((item) => item && typeof item === "object");
  if (!matchingEntry || typeof matchingEntry !== "object") {
    return {};
  }

  const entry = matchingEntry as Record<string, unknown>;
  const entryStatus = typeof entry.status === "string" ? entry.status : undefined;
  const entryError = typeof entry.error === "string" ? entry.error : undefined;
  const shutdown = entry.shutdown_room;
  const shutdownError =
    shutdown && typeof shutdown === "object" && typeof (shutdown as Record<string, unknown>).error === "string"
      ? ((shutdown as Record<string, unknown>).error as string)
      : undefined;
  return {
    status: entryStatus,
    error: entryError ?? shutdownError
  };
};

export const isSynapseDeleteComplete = (status: string | undefined) =>
  typeof status === "string" && status.toLowerCase() === "complete";

export const isSynapseDeleteFailed = (status: string | undefined) =>
  typeof status === "string" && status.toLowerCase() === "failed";

export const pollSynapseDeleteStatus = async ({
  baseUrl,
  roomId,
  deleteId,
  accessToken
}: {
  baseUrl: string;
  roomId: string;
  deleteId: string;
  accessToken: string;
}) => {
  const encodedRoomId = encodeURIComponent(roomId);
  const encodedDeleteId = encodeURIComponent(deleteId);
  const headers = {
    Authorization: `Bearer ${accessToken}`
  };
  const timeoutMs = 90_000;
  const startedAt = Date.now();
  let mode: "by-delete-id" | "by-room-id" = "by-delete-id";

  while (Date.now() - startedAt < timeoutMs) {
    const statusUrl =
      mode === "by-delete-id"
        ? `${baseUrl}/_synapse/admin/v2/rooms/delete_status/${encodedDeleteId}`
        : `${baseUrl}/_synapse/admin/v2/rooms/${encodedRoomId}/delete_status`;
    const statusResponse = await fetch(statusUrl, {
      method: "GET",
      headers
    });

    if (statusResponse.status === 404 || statusResponse.status === 405) {
      if (mode === "by-delete-id") {
        mode = "by-room-id";
        continue;
      }
      return;
    }
    if (!statusResponse.ok) {
      throw new Error(await readErrorBody(statusResponse));
    }

    const payload = await statusResponse.json().catch(() => null);
    const deleteStatus = parseSynapseDeleteStatus(payload, deleteId);
    if (isSynapseDeleteComplete(deleteStatus.status)) {
      return;
    }
    if (isSynapseDeleteFailed(deleteStatus.status)) {
      throw new Error(deleteStatus.error ?? "Synapse room deletion failed.");
    }
    await delay(1500);
  }

  throw new Error("Timed out waiting for Synapse room purge completion.");
};

export const waitForSynapseRoomRemoval = async ({
  baseUrl,
  roomId,
  accessToken
}: {
  baseUrl: string;
  roomId: string;
  accessToken: string;
}) => {
  const encodedRoomId = encodeURIComponent(roomId);
  const timeoutMs = 90_000;
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const response = await fetch(`${baseUrl}/_synapse/admin/v1/rooms/${encodedRoomId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    if (response.status === 404) {
      return;
    }
    if (!response.ok) {
      throw new Error(await readErrorBody(response));
    }
    await delay(1500);
  }
  throw new Error("Synapse still reports this room after deletion. Purge did not complete.");
};

export const requestSynapseHardDelete = async ({
  baseUrl,
  accessToken,
  roomId,
  requesterUserId
}: SynapseDeleteRequest) => {
  const normalizedBase = normalizeBaseUrl(baseUrl);
  if (hasTauriRuntime()) {
    try {
      await invoke("synapse_hard_delete_room", {
        baseUrl: normalizedBase,
        accessToken,
        roomId,
        requesterUserId
      });
      return;
    } catch (error) {
      // Fallback keeps browser-mode compatibility if native invoke is unavailable.
      console.warn("Native Synapse hard-delete failed; falling back to fetch", error);
    }
  }

  const encodedRoomId = encodeURIComponent(roomId);
  const requestBody = {
    block: true,
    purge: true,
    force_purge: true,
    requester_user_id: requesterUserId
  };
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json"
  };

  const attemptV2 = async () => {
    const response = await fetch(`${normalizedBase}/_synapse/admin/v2/rooms/${encodedRoomId}`, {
      method: "DELETE",
      headers,
      body: JSON.stringify(requestBody)
    });
    if (response.status === 404 || response.status === 405) {
      return false;
    }
    if (!response.ok) {
      throw new Error(await readErrorBody(response));
    }
    const payload = (await response.json().catch(() => null)) as { delete_id?: string; status?: string } | null;
    const deleteId = typeof payload?.delete_id === "string" ? payload.delete_id : null;
    if (deleteId) {
      await pollSynapseDeleteStatus({
        baseUrl: normalizedBase,
        roomId,
        deleteId,
        accessToken
      });
    }
    return true;
  };

  const attemptV1Delete = async () => {
    const response = await fetch(`${normalizedBase}/_synapse/admin/v1/rooms/${encodedRoomId}`, {
      method: "DELETE",
      headers,
      body: JSON.stringify(requestBody)
    });
    if (response.status === 404 || response.status === 405) {
      return false;
    }
    if (!response.ok) {
      throw new Error(await readErrorBody(response));
    }
    return true;
  };

  const attemptLegacyDelete = async () => {
    const response = await fetch(`${normalizedBase}/_synapse/admin/v1/rooms/${encodedRoomId}/delete`, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody)
    });
    if (!response.ok) {
      throw new Error(await readErrorBody(response));
    }
    return true;
  };

  const usedV2 = await attemptV2();
  if (!usedV2) {
    const usedV1 = await attemptV1Delete();
    if (!usedV1) {
      await attemptLegacyDelete();
    }
  }
  await waitForSynapseRoomRemoval({
    baseUrl: normalizedBase,
    roomId,
    accessToken
  });
};

export const createDefaultPermissionOverrides = (): SpacePermissionOverrides => ({
  version: 1,
  categories: {},
  rooms: {}
});

export const normalizePermissionRule = (value: unknown): PermissionRule | undefined => {
  if (value === "inherit" || value === "allow" || value === "deny") {
    return value;
  }
  return undefined;
};

export const normalizePermissionRuleSet = (
  value: unknown
): Record<PermissionAction, PermissionRule | undefined> => {
  if (!value || typeof value !== "object") {
    return {} as Record<PermissionAction, PermissionRule | undefined>;
  }
  const input = value as Record<string, unknown>;
  return PERMISSION_ACTIONS.reduce<Record<PermissionAction, PermissionRule | undefined>>(
    (accumulator, action) => {
      accumulator[action] = normalizePermissionRule(input[action]);
      return accumulator;
    },
    {} as Record<PermissionAction, PermissionRule | undefined>
  );
};

export const compactPermissionRuleSet = (
  value: Record<PermissionAction, PermissionRule | undefined>
) => {
  return PERMISSION_ACTIONS.reduce<PermissionRuleSet>((accumulator, action) => {
    const rule = value[action];
    if (rule === "allow" || rule === "deny") {
      accumulator[action] = rule;
    }
    return accumulator;
  }, {});
};

export const normalizePermissionOverrides = (value: unknown): SpacePermissionOverrides => {
  if (!value || typeof value !== "object") {
    return createDefaultPermissionOverrides();
  }
  const input = value as Record<string, unknown>;
  const categoriesRaw =
    input.categories && typeof input.categories === "object"
      ? (input.categories as Record<string, unknown>)
      : {};
  const roomsRaw =
    input.rooms && typeof input.rooms === "object"
      ? (input.rooms as Record<string, unknown>)
      : {};

  const categories = Object.entries(categoriesRaw).reduce<Record<string, PermissionRuleSet>>(
    (accumulator, [categoryId, ruleSet]) => {
      const compacted = compactPermissionRuleSet(normalizePermissionRuleSet(ruleSet));
      if (Object.keys(compacted).length) {
        accumulator[categoryId] = compacted;
      }
      return accumulator;
    },
    {}
  );
  const rooms = Object.entries(roomsRaw).reduce<Record<string, PermissionRuleSet>>(
    (accumulator, [roomId, ruleSet]) => {
      const compacted = compactPermissionRuleSet(normalizePermissionRuleSet(ruleSet));
      if (Object.keys(compacted).length) {
        accumulator[roomId] = compacted;
      }
      return accumulator;
    },
    {}
  );

  return {
    version: 1,
    categories,
    rooms
  };
};

export const normalizeAuditEvents = (value: unknown): ModerationAuditEvent[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => item as Record<string, unknown>)
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : uid("audit"),
      action: typeof item.action === "string" ? item.action : "unknown",
      actorId: typeof item.actorId === "string" ? item.actorId : "unknown",
      target: typeof item.target === "string" ? item.target : "unknown",
      timestamp: typeof item.timestamp === "number" ? item.timestamp : Date.now(),
      sourceEventId: typeof item.sourceEventId === "string" ? item.sourceEventId : undefined
    }))
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, 250);
};

export const normalizeCategoryName = (value: string) => value.trim() || DEFAULT_CATEGORY_NAME;

export const toCategoryId = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || uid("cat");

export const normalizeLayoutCategories = (categories: SpaceLayoutCategory[]) => {
  const seen = new Set<string>();
  const deduped = categories
    .filter((category) => Boolean(category.id))
    .filter((category) => {
      if (seen.has(category.id)) return false;
      seen.add(category.id);
      return true;
    })
    .map((category, index) => ({
      id: category.id,
      name: normalizeCategoryName(category.name),
      order: Number.isFinite(category.order) ? category.order : index
    }))
    .sort((left, right) => left.order - right.order);

  if (!deduped.some((category) => category.id === DEFAULT_CATEGORY_ID)) {
    deduped.unshift({ id: DEFAULT_CATEGORY_ID, name: DEFAULT_CATEGORY_NAME, order: -1 });
  }

  return deduped.map((category, index) => ({ ...category, order: index }));
};

export const deriveLayoutFromRooms = (rooms: Room[]): SpaceLayout => {
  const categoryNameById = new Map<string, string>();

  rooms
    .filter((room) => room.type !== "dm")
    .forEach((room) => {
      const categoryId = room.category?.trim() || DEFAULT_CATEGORY_ID;
      categoryNameById.set(
        categoryId,
        categoryId === DEFAULT_CATEGORY_ID ? DEFAULT_CATEGORY_NAME : categoryId
      );
    });

  if (!categoryNameById.size) {
    categoryNameById.set(DEFAULT_CATEGORY_ID, DEFAULT_CATEGORY_NAME);
  }

  const categories = Array.from(categoryNameById.entries()).map(([id, name], order) => ({
    id,
    name,
    order
  }));

  const roomOrderByCategory = new Map<string, number>();
  const roomLayouts: Record<string, SpaceLayoutRoom> = {};

  rooms
    .filter((room) => room.type !== "dm")
    .forEach((room) => {
      const categoryId = room.category?.trim() || DEFAULT_CATEGORY_ID;
      const nextOrder = roomOrderByCategory.get(categoryId) ?? 0;
      roomLayouts[room.id] = { categoryId, order: nextOrder };
      roomOrderByCategory.set(categoryId, nextOrder + 1);
    });

  return {
    version: 1,
    categories: normalizeLayoutCategories(categories),
    rooms: roomLayouts
  };
};

export const parseSpaceLayout = (spaceRoom: MatrixRoom | null | undefined): SpaceLayout | null => {
  if (!spaceRoom) return null;
  const event = spaceRoom.currentState.getStateEvents(SPACE_LAYOUT_EVENT, "");
  const content = event?.getContent();
  if (!content || typeof content !== "object") return null;

  const categories = Array.isArray(content.categories)
    ? content.categories
        .filter((category) => category && typeof category === "object")
        .map((category) => ({
          id: typeof category.id === "string" ? category.id : "",
          name: typeof category.name === "string" ? category.name : DEFAULT_CATEGORY_NAME,
          order: typeof category.order === "number" ? category.order : 0
        }))
    : [];

  const roomsRaw =
    content.rooms && typeof content.rooms === "object" ? content.rooms : {};
  const rooms = Object.entries(roomsRaw as Record<string, any>).reduce<Record<string, SpaceLayoutRoom>>(
    (accumulator, [roomId, placement]) => {
      if (!placement || typeof placement !== "object") return accumulator;
      const categoryId =
        typeof placement.categoryId === "string" && placement.categoryId
          ? placement.categoryId
          : DEFAULT_CATEGORY_ID;
      const order = typeof placement.order === "number" ? placement.order : 0;
      accumulator[roomId] = { categoryId, order };
      return accumulator;
    },
    {}
  );

  return {
    version: 1,
    categories: normalizeLayoutCategories(categories),
    rooms
  };
};

export const parseServerSettings = (spaceRoom: MatrixRoom | null | undefined): ServerSettings | null => {
  if (!spaceRoom) return null;
  const event = spaceRoom.currentState.getStateEvents(SERVER_SETTINGS_EVENT, "");
  const content = event?.getContent();
  if (!content || typeof content !== "object") return null;
  return normalizeServerSettings(content as Partial<ServerSettings>);
};

export const parseServerMetaName = (spaceRoom: MatrixRoom | null | undefined): string | null => {
  if (!spaceRoom) return null;
  const event = spaceRoom.currentState.getStateEvents(SERVER_META_EVENT, "");
  const content = event?.getContent();
  const name = content?.name;
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  return trimmed || null;
};

export const parsePermissionOverrides = (spaceRoom: MatrixRoom | null | undefined): SpacePermissionOverrides | null => {
  if (!spaceRoom) return null;
  const event = spaceRoom.currentState.getStateEvents(PERMISSION_OVERRIDES_EVENT, "");
  const content = event?.getContent();
  return normalizePermissionOverrides(content);
};

export const parseModerationAudit = (spaceRoom: MatrixRoom | null | undefined): ModerationAuditEvent[] | null => {
  if (!spaceRoom) return null;
  const event = spaceRoom.currentState.getStateEvents(AUDIT_LOG_EVENT, "");
  const content = event?.getContent();
  if (!content || typeof content !== "object") return [];
  const eventsRaw = (content as Record<string, unknown>).events;
  return normalizeAuditEvents(eventsRaw);
};

export const hydrateLayoutForRooms = (layout: SpaceLayout | null, rooms: Room[]): SpaceLayout => {
  const base = layout ?? deriveLayoutFromRooms(rooms);
  const categories = normalizeLayoutCategories(base.categories);
  const categoryIds = new Set(categories.map((category) => category.id));
  const roomLayouts: Record<string, SpaceLayoutRoom> = {};
  const nextOrderByCategory = new Map<string, number>();

  rooms
    .filter((room) => room.type !== "dm")
    .forEach((room) => {
      const existing = base.rooms[room.id];
      const fallbackCategory = room.category?.trim() || DEFAULT_CATEGORY_ID;
      const candidateCategory = existing?.categoryId || fallbackCategory;
      const categoryId = categoryIds.has(candidateCategory) ? candidateCategory : DEFAULT_CATEGORY_ID;
      const currentNext = nextOrderByCategory.get(categoryId) ?? 0;
      const proposedOrder = existing?.order;
      const order =
        typeof proposedOrder === "number" && proposedOrder >= currentNext
          ? proposedOrder
          : currentNext;

      roomLayouts[room.id] = { categoryId, order };
      nextOrderByCategory.set(categoryId, order + 1);
    });

  return {
    version: 1,
    categories,
    rooms: roomLayouts
  };
};

export const applyLayoutToRooms = (rooms: Room[], layout: SpaceLayout): Room[] =>
  rooms
    .map((room) => {
      if (room.type === "dm") return room;
      const placement = layout.rooms[room.id];
      return {
        ...room,
        category: placement?.categoryId ?? DEFAULT_CATEGORY_ID,
        sortOrder: placement?.order ?? 0
      };
    })
    .sort((left, right) => {
      if (left.type === "dm" && right.type !== "dm") return 1;
      if (right.type === "dm" && left.type !== "dm") return -1;
      if (left.type === "dm" && right.type === "dm") return left.name.localeCompare(right.name);

      const leftOrder = left.sortOrder ?? 0;
      const rightOrder = right.sortOrder ?? 0;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.name.localeCompare(right.name);
    });

export const layoutToCategories = (layout: SpaceLayout): Category[] =>
  normalizeLayoutCategories(layout.categories).map((category) => ({
    id: category.id,
    name: category.name,
    order: category.order
  }));

export const moveItem = <T>(items: T[], sourceIndex: number, targetIndex: number) => {
  if (sourceIndex < 0 || targetIndex < 0) return items;
  if (sourceIndex === targetIndex) return items;
  const copy = [...items];
  const [item] = copy.splice(sourceIndex, 1);
  if (!item) return items;
  copy.splice(targetIndex, 0, item);
  return copy;
};

export const getSpaceRooms = (rooms: Room[], spaceId: string) =>
  rooms.filter((room) => room.spaceId === spaceId);

export const withUpdatedSpaceRooms = (rooms: Room[], spaceId: string, updatedSpaceRooms: Room[]) => {
  const hasMixedSpaces = rooms.some((room) => room.spaceId !== spaceId);
  if (!hasMixedSpaces) {
    return updatedSpaceRooms;
  }
  return [...rooms.filter((room) => room.spaceId !== spaceId), ...updatedSpaceRooms];
};

export const applyLayoutToSpaceRooms = (rooms: Room[], spaceId: string, layout: SpaceLayout) =>
  withUpdatedSpaceRooms(
    rooms,
    spaceId,
    applyLayoutToRooms(getSpaceRooms(rooms, spaceId), layout)
  );

export const getOrderedRoomIdsByCategory = (layout: SpaceLayout, categoryId: string) =>
  Object.entries(layout.rooms)
    .filter(([, placement]) => placement.categoryId === categoryId)
    .sort((left, right) => left[1].order - right[1].order)
    .map(([roomId]) => roomId);

export const setRoomOrderForCategory = (layout: SpaceLayout, categoryId: string, roomIds: string[]) => {
  roomIds.forEach((roomId, order) => {
    layout.rooms[roomId] = { categoryId, order };
  });
};

export const resolveSpaceStateHostRoomId = (
  state: Pick<AppState, "currentRoomId" | "rooms" | "spaceStateHostRoomIdBySpaceId">,
  spaceId: string
) => {
  if (!spaceId) return null;
  if (spaceId !== DEFAULT_SPACE.id) return spaceId;

  const mappedHost = state.spaceStateHostRoomIdBySpaceId[spaceId];
  if (mappedHost) return mappedHost;

  const currentRoom = state.rooms.find((room) => room.id === state.currentRoomId);
  if (currentRoom) return currentRoom.id;

  const firstNonDm = state.rooms.find((room) => room.type !== "dm");
  if (firstNonDm) return firstNonDm.id;

  return state.rooms[0]?.id ?? null;
};

export const filterMessagesByIds = (messages: Message[], removeIds: string[]) => {
  if (!removeIds.length) return messages;
  const blocked = new Set(removeIds.filter((id) => Boolean(id)));
  if (!blocked.size) return messages;
  return messages.filter((message) => !blocked.has(message.id));
};

export const mergeMessagesById = (existingMessages: Message[], timelineMessages: Message[]) => {
  const merged = new Map<string, Message>();
  existingMessages.forEach((message) => {
    merged.set(message.id, message);
  });
  timelineMessages.forEach((message) => {
    merged.set(message.id, message);
  });
  return Array.from(merged.values()).sort((left, right) => {
    if (left.timestamp !== right.timestamp) {
      return left.timestamp - right.timestamp;
    }
    return left.id.localeCompare(right.id);
  });
};

export const resolveTimelineMessages = ({
  existingMessages,
  timelineMessages,
  removeMessageIds = []
}: {
  existingMessages: Message[];
  timelineMessages: Message[];
  removeMessageIds?: string[];
}) => {
  return filterMessagesByIds(mergeMessagesById(existingMessages, timelineMessages), removeMessageIds);
};

export const mapMockMessagesByRoomId = (rooms: Room[], allMessages: Message[]) =>
  rooms.reduce<Record<string, Message[]>>((accumulator, room) => {
    accumulator[room.id] = allMessages.filter((message) => message.roomId === room.id);
    return accumulator;
  }, {});

export const getLatestMessageTimestamp = (messages: Message[]) =>
  messages.length ? messages[messages.length - 1]?.timestamp ?? Date.now() : Date.now();

export const buildInitialRoomReadMarkers = (
  rooms: Room[],
  messagesByRoomId: Record<string, Message[]>
) =>
  rooms.reduce<Record<string, number>>((accumulator, room) => {
    const messages = messagesByRoomId[room.id] ?? [];
    if (!messages.length) {
      accumulator[room.id] = Date.now();
      return accumulator;
    }
    if (room.unreadCount <= 0) {
      accumulator[room.id] = getLatestMessageTimestamp(messages);
      return accumulator;
    }

    const unreadStartIndex = Math.max(messages.length - room.unreadCount, 0);
    const lastRead = messages[unreadStartIndex - 1];
    accumulator[room.id] = lastRead?.timestamp ?? 0;
    return accumulator;
  }, {});

export const defaultCallState: CallState = {
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

export const areAdvancedCallsEnabled = () => featureFlags.enableAdvancedCalls;

export const defaultServerSettingsBySpace = mockSpaces.reduce<Record<string, ServerSettings>>((accumulator, space) => {
  accumulator[space.id] = createDefaultServerSettings();
  return accumulator;
}, {});

export const defaultPermissionOverridesBySpace = mockSpaces.reduce<Record<string, SpacePermissionOverrides>>(
  (accumulator, space) => {
    accumulator[space.id] = createDefaultPermissionOverrides();
    return accumulator;
  },
  {}
);

export const defaultModerationAuditBySpace = mockSpaces.reduce<Record<string, ModerationAuditEvent[]>>(
  (accumulator, space) => {
    accumulator[space.id] = [];
    return accumulator;
  },
  {}
);

export const defaultMockMessagesByRoomId = mapMockMessagesByRoomId(mockRooms, mockMessages);
export const defaultRoomLastReadTsByRoomId = buildInitialRoomReadMarkers(mockRooms, defaultMockMessagesByRoomId);
export const loadedPreferences = loadPreferences();
export const initialMe = applyProfileToUser(
  mockMe,
  loadedPreferences.profileDisplayName,
  loadedPreferences.profileAvatarDataUrl
);
export const initialUsers = applyProfileToUsers(
  mockUsers,
  mockMe.id,
  loadedPreferences.profileDisplayName,
  loadedPreferences.profileAvatarDataUrl
);

export type AppStateSet = Parameters<StateCreator<AppState>>[0];
export type AppStateGet = Parameters<StateCreator<AppState>>[1];

export type AppStateCreator = (set: AppStateSet, get: AppStateGet) => AppState;
