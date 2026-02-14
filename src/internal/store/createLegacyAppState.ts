import type { StateCreator } from "zustand";
import {
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
  type CallFeed,
  type MatrixClient,
  type MatrixRoom,
  createSessionMatrixClient,
  logoutMatrixClient,
  startMatrixClient,
  stopMatrixClient
} from "../../matrix/client";
import {
  clearMatrixSession,
  loadMatrixSession,
  loginWithPassword,
  registerWithPassword,
  saveMatrixSession,
  type MatrixSession
} from "../../matrix/session";
import {
  buildSpaceIndex,
  getDirectRoomIds,
  isRoomDeleted,
  mapMatrixRoom,
  mapMembers
} from "../../matrix/rooms";
import {
  getRedactionTargetEventId,
  loadRoomMessagesWithBackfill,
  mapEventsToMessages
} from "../../matrix/timeline";
import { featureFlags } from "../../config/featureFlags";
import { invoke } from "@tauri-apps/api/core";
import {
  messages as mockMessages,
  me as mockMe,
  rooms as mockRooms,
  spaces as mockSpaces,
  users as mockUsers
} from "../../data/mock";
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
} from "../../types";
import { trackLocalMetricEvent } from "../../services/localMetricsService";
import { canDeleteChannelsAndCategories, parsePowerLevels } from "../../services/permissionService";

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

const ROOM_TYPE_EVENT = "com.fray.room_type";
const PREFERENCES_KEY = "fray.preferences";
const PENDING_REDACTIONS_KEY = "fray.pending_redactions";
const SPACE_LAYOUT_EVENT = "com.fray.space_layout";
const SERVER_SETTINGS_EVENT = "com.fray.server_settings";
const SERVER_META_EVENT = "com.fray.server_meta";
const PERMISSION_OVERRIDES_EVENT = "com.fray.permission_overrides";
const AUDIT_LOG_EVENT = "com.fray.audit_log";
const DEFAULT_CATEGORY_ID = "channels";
const DEFAULT_CATEGORY_NAME = "Channels";
const PENDING_REDACTION_TTL_MS = 24 * 60 * 60 * 1000;
const PENDING_REDACTION_MAX_ITEMS = 200;

const DEFAULT_SPACE: Space = { id: "all", name: "All Rooms", icon: "M" };

const toMembership = (value: string | undefined) => {
  if (value === "join" || value === "invite" || value === "leave" || value === "ban" || value === "knock") {
    return value;
  }
  return "unknown";
};

type MatrixStatus = "idle" | "connecting" | "syncing" | "error";
export type ServerSettingsTab =
  | "overview"
  | "roles"
  | "members"
  | "channels"
  | "invites"
  | "moderation"
  | "health";

interface PendingRedactionIntent {
  roomId: string;
  transactionId: string;
  sourceMessageId: string;
  queuedAt: number;
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

interface UserPreferences {
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

interface SpaceLayoutCategory {
  id: string;
  name: string;
  order: number;
}

interface SpaceLayoutRoom {
  categoryId: string;
  order: number;
}

interface SpaceLayout {
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

const defaultUserPreferences: UserPreferences = {
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

const normalizeFontScale = (value: unknown): 1 | 1.1 | 1.2 => {
  if (value === 1.1 || value === 1.2 || value === 1) {
    return value;
  }
  return 1;
};

const normalizePreferences = (value: Partial<UserPreferences> | null | undefined): UserPreferences => {
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

const toPreferencesFromState = (
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

const createNotification = (
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

const loadPreferences = (): UserPreferences => {
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

const savePreferences = (preferences: UserPreferences) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
};

const normalizePendingRedactionIntent = (value: unknown): PendingRedactionIntent | null => {
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

const prunePendingRedactionIntents = (intents: PendingRedactionIntent[]) => {
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

const loadPendingRedactionIntents = (): PendingRedactionIntent[] => {
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

const savePendingRedactionIntents = (intents: PendingRedactionIntent[]) => {
  if (typeof window === "undefined") return;
  const pruned = prunePendingRedactionIntents(intents);
  if (!pruned.length) {
    localStorage.removeItem(PENDING_REDACTIONS_KEY);
    return;
  }
  localStorage.setItem(PENDING_REDACTIONS_KEY, JSON.stringify(pruned));
};

const queuePendingRedactionIntent = (intent: PendingRedactionIntent) => {
  const existing = loadPendingRedactionIntents().filter(
    (entry) => !(entry.roomId === intent.roomId && entry.transactionId === intent.transactionId)
  );
  savePendingRedactionIntents([intent, ...existing]);
};

const removePendingRedactionIntent = (roomId: string, transactionId: string) => {
  const existing = loadPendingRedactionIntents().filter(
    (entry) => !(entry.roomId === roomId && entry.transactionId === transactionId)
  );
  savePendingRedactionIntents(existing);
};

const getPendingRedactionIntentsForRoom = (roomId: string) =>
  loadPendingRedactionIntents().filter((entry) => entry.roomId === roomId);

const getLocalEchoTransactionId = (roomId: string, messageId: string) => {
  const localIdPrefix = `~${roomId}:`;
  if (!messageId.startsWith(localIdPrefix)) return null;
  const transactionId = messageId.slice(localIdPrefix.length);
  return transactionId.trim() ? transactionId : null;
};

const findRemoteEchoEventId = (room: MatrixRoom, transactionId: string) => {
  const remoteEchoEvent = (room.getLiveTimeline?.().getEvents?.() ?? []).find(
    (event) => event.getUnsigned()?.transaction_id === transactionId
  );
  return remoteEchoEvent?.getId() ?? null;
};

const pendingRedactionIntentKey = (roomId: string, transactionId: string) =>
  `${roomId}::${transactionId}`;

const pendingRedactionInFlight = new Set<string>();

const reconcilePendingRedactionsForRoom = ({
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

const getAvatarInitial = (name: string) => name.slice(0, 1).toUpperCase() || "?";

const toDisplayName = (override: string | undefined, fallback: string) => {
  const next = override?.trim();
  return next ? next.slice(0, 32) : fallback;
};

const applyProfileToUser = (
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

const applyProfileToUsers = (
  users: User[],
  meId: string,
  profileDisplayName: string,
  profileAvatarDataUrl: string | null
) =>
  users.map((user) =>
    user.id === meId ? applyProfileToUser(user, profileDisplayName, profileAvatarDataUrl) : user
  );

const createDefaultLayout = (): SpaceLayout => ({
  version: 1,
  categories: [{ id: DEFAULT_CATEGORY_ID, name: DEFAULT_CATEGORY_NAME, order: 0 }],
  rooms: {}
});

const createDefaultServerSettings = (): ServerSettings => ({
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

const normalizeRoleDefinitions = (value: unknown): ServerRoleDefinition[] => {
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

const normalizeRoleAssignments = (
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

const applyServerRolesToUsers = (users: User[], settings: ServerSettings): User[] => {
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

const stripServerRolesFromUsers = (users: User[], settings: ServerSettings): User[] => {
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

const withAppliedServerRoles = (users: User[], settings: ServerSettings) =>
  applyServerRolesToUsers(stripServerRolesFromUsers(users, settings), settings);

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const normalizeServerSettings = (settings: Partial<ServerSettings> | null | undefined): ServerSettings => {
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

const getRolePermissionGrant = (
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

const canCurrentUserDeleteChannelsInSpace = (
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

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, "");

const readErrorBody = async (response: Response) => {
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

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });

interface SynapseDeleteRequest {
  baseUrl: string;
  accessToken: string;
  roomId: string;
  requesterUserId: string;
}

interface SynapseDeleteStatus {
  status?: string;
  error?: string;
}

const hasTauriRuntime = () => {
  if (typeof window === "undefined") return false;
  return typeof (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== "undefined";
};

const parseSynapseDeleteStatus = (payload: unknown, deleteId: string): SynapseDeleteStatus => {
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

const isSynapseDeleteComplete = (status: string | undefined) =>
  typeof status === "string" && status.toLowerCase() === "complete";

const isSynapseDeleteFailed = (status: string | undefined) =>
  typeof status === "string" && status.toLowerCase() === "failed";

const pollSynapseDeleteStatus = async ({
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

const waitForSynapseRoomRemoval = async ({
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

const requestSynapseHardDelete = async ({
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

const createDefaultPermissionOverrides = (): SpacePermissionOverrides => ({
  version: 1,
  categories: {},
  rooms: {}
});

const normalizePermissionRule = (value: unknown): PermissionRule | undefined => {
  if (value === "inherit" || value === "allow" || value === "deny") {
    return value;
  }
  return undefined;
};

const normalizePermissionRuleSet = (
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

const compactPermissionRuleSet = (
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

const normalizePermissionOverrides = (value: unknown): SpacePermissionOverrides => {
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

const normalizeAuditEvents = (value: unknown): ModerationAuditEvent[] => {
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

const normalizeCategoryName = (value: string) => value.trim() || DEFAULT_CATEGORY_NAME;

const toCategoryId = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || uid("cat");

const normalizeLayoutCategories = (categories: SpaceLayoutCategory[]) => {
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

const deriveLayoutFromRooms = (rooms: Room[]): SpaceLayout => {
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

const parseSpaceLayout = (spaceRoom: MatrixRoom | null | undefined): SpaceLayout | null => {
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

const parseServerSettings = (spaceRoom: MatrixRoom | null | undefined): ServerSettings | null => {
  if (!spaceRoom) return null;
  const event = spaceRoom.currentState.getStateEvents(SERVER_SETTINGS_EVENT, "");
  const content = event?.getContent();
  if (!content || typeof content !== "object") return null;
  return normalizeServerSettings(content as Partial<ServerSettings>);
};

const parseServerMetaName = (spaceRoom: MatrixRoom | null | undefined): string | null => {
  if (!spaceRoom) return null;
  const event = spaceRoom.currentState.getStateEvents(SERVER_META_EVENT, "");
  const content = event?.getContent();
  const name = content?.name;
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  return trimmed || null;
};

const parsePermissionOverrides = (spaceRoom: MatrixRoom | null | undefined): SpacePermissionOverrides | null => {
  if (!spaceRoom) return null;
  const event = spaceRoom.currentState.getStateEvents(PERMISSION_OVERRIDES_EVENT, "");
  const content = event?.getContent();
  return normalizePermissionOverrides(content);
};

const parseModerationAudit = (spaceRoom: MatrixRoom | null | undefined): ModerationAuditEvent[] | null => {
  if (!spaceRoom) return null;
  const event = spaceRoom.currentState.getStateEvents(AUDIT_LOG_EVENT, "");
  const content = event?.getContent();
  if (!content || typeof content !== "object") return [];
  const eventsRaw = (content as Record<string, unknown>).events;
  return normalizeAuditEvents(eventsRaw);
};

const hydrateLayoutForRooms = (layout: SpaceLayout | null, rooms: Room[]): SpaceLayout => {
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

const applyLayoutToRooms = (rooms: Room[], layout: SpaceLayout): Room[] =>
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

const layoutToCategories = (layout: SpaceLayout): Category[] =>
  normalizeLayoutCategories(layout.categories).map((category) => ({
    id: category.id,
    name: category.name,
    order: category.order
  }));

const moveItem = <T>(items: T[], sourceIndex: number, targetIndex: number) => {
  if (sourceIndex < 0 || targetIndex < 0) return items;
  if (sourceIndex === targetIndex) return items;
  const copy = [...items];
  const [item] = copy.splice(sourceIndex, 1);
  if (!item) return items;
  copy.splice(targetIndex, 0, item);
  return copy;
};

const getSpaceRooms = (rooms: Room[], spaceId: string) =>
  rooms.filter((room) => room.spaceId === spaceId);

const withUpdatedSpaceRooms = (rooms: Room[], spaceId: string, updatedSpaceRooms: Room[]) => {
  const hasMixedSpaces = rooms.some((room) => room.spaceId !== spaceId);
  if (!hasMixedSpaces) {
    return updatedSpaceRooms;
  }
  return [...rooms.filter((room) => room.spaceId !== spaceId), ...updatedSpaceRooms];
};

const applyLayoutToSpaceRooms = (rooms: Room[], spaceId: string, layout: SpaceLayout) =>
  withUpdatedSpaceRooms(
    rooms,
    spaceId,
    applyLayoutToRooms(getSpaceRooms(rooms, spaceId), layout)
  );

const getOrderedRoomIdsByCategory = (layout: SpaceLayout, categoryId: string) =>
  Object.entries(layout.rooms)
    .filter(([, placement]) => placement.categoryId === categoryId)
    .sort((left, right) => left[1].order - right[1].order)
    .map(([roomId]) => roomId);

const setRoomOrderForCategory = (layout: SpaceLayout, categoryId: string, roomIds: string[]) => {
  roomIds.forEach((roomId, order) => {
    layout.rooms[roomId] = { categoryId, order };
  });
};

const resolveSpaceStateHostRoomId = (
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

const filterMessagesByIds = (messages: Message[], removeIds: string[]) => {
  if (!removeIds.length) return messages;
  const blocked = new Set(removeIds.filter((id) => Boolean(id)));
  if (!blocked.size) return messages;
  return messages.filter((message) => !blocked.has(message.id));
};

const mergeMessagesById = (existingMessages: Message[], timelineMessages: Message[]) => {
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

const resolveTimelineMessages = ({
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

const mapMockMessagesByRoomId = (rooms: Room[], allMessages: Message[]) =>
  rooms.reduce<Record<string, Message[]>>((accumulator, room) => {
    accumulator[room.id] = allMessages.filter((message) => message.roomId === room.id);
    return accumulator;
  }, {});

const getLatestMessageTimestamp = (messages: Message[]) =>
  messages.length ? messages[messages.length - 1]?.timestamp ?? Date.now() : Date.now();

const buildInitialRoomReadMarkers = (
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

const areAdvancedCallsEnabled = () => featureFlags.enableAdvancedCalls;

const defaultServerSettingsBySpace = mockSpaces.reduce<Record<string, ServerSettings>>((accumulator, space) => {
  accumulator[space.id] = createDefaultServerSettings();
  return accumulator;
}, {});

const defaultPermissionOverridesBySpace = mockSpaces.reduce<Record<string, SpacePermissionOverrides>>(
  (accumulator, space) => {
    accumulator[space.id] = createDefaultPermissionOverrides();
    return accumulator;
  },
  {}
);

const defaultModerationAuditBySpace = mockSpaces.reduce<Record<string, ModerationAuditEvent[]>>(
  (accumulator, space) => {
    accumulator[space.id] = [];
    return accumulator;
  },
  {}
);

const defaultMockMessagesByRoomId = mapMockMessagesByRoomId(mockRooms, mockMessages);
const defaultRoomLastReadTsByRoomId = buildInitialRoomReadMarkers(mockRooms, defaultMockMessagesByRoomId);
const loadedPreferences = loadPreferences();
const initialMe = applyProfileToUser(
  mockMe,
  loadedPreferences.profileDisplayName,
  loadedPreferences.profileAvatarDataUrl
);
const initialUsers = applyProfileToUsers(
  mockUsers,
  mockMe.id,
  loadedPreferences.profileDisplayName,
  loadedPreferences.profileAvatarDataUrl
);

type AppStateSet = Parameters<StateCreator<AppState>>[0];
type AppStateGet = Parameters<StateCreator<AppState>>[1];

export type AppStateCreator = (set: AppStateSet, get: AppStateGet) => AppState;

export const createLegacyAppState: AppStateCreator = (set, get) => ({
  me: initialMe,
  users: initialUsers,
  spaces: mockSpaces,
  rooms: mockRooms,
  messagesByRoomId: defaultMockMessagesByRoomId,
  currentSpaceId: mockSpaces[0]?.id ?? DEFAULT_SPACE.id,
  currentRoomId: mockRooms[0]?.id ?? "",
  threadRootId: null,
  replyToId: null,
  showMembers: true,
  showThread: false,
  showPins: false,
  showServerSettings: false,
  serverSettingsTab: "overview",
  searchQuery: "",
  composerEnterToSend: loadedPreferences.composerEnterToSend,
  messageDensity: loadedPreferences.messageDensity,
  notificationsEnabled: loadedPreferences.notificationsEnabled,
  mentionsOnlyNotifications: loadedPreferences.mentionsOnlyNotifications,
  keybindsEnabled: loadedPreferences.keybindsEnabled,
  composerSpellcheck: loadedPreferences.composerSpellcheck,
  reducedMotion: loadedPreferences.reducedMotion,
  highContrast: loadedPreferences.highContrast,
  fontScale: loadedPreferences.fontScale,
  theme: loadedPreferences.theme,
  isOnline: true,
  onboardingStep: loadedPreferences.onboardingCompleted ? null : 0,
  profileDisplayName: loadedPreferences.profileDisplayName,
  profileAbout: loadedPreferences.profileAbout,
  profileAvatarDataUrl: loadedPreferences.profileAvatarDataUrl,
  notifications: [],
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
  matrixClient: null,
  matrixStatus: "idle",
  matrixError: null,
  matrixSession: null,
  callState: defaultCallState,
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
      messagesByRoomId: defaultMockMessagesByRoomId
    });
  },
  selectSpace: (spaceId) => {
    const client = get().matrixClient;
    if (!client) {
      set((state) => {
        const nextRoomId = state.rooms.find((room) => room.spaceId === spaceId)?.id ?? state.currentRoomId;
        const nextRoomMessages = state.messagesByRoomId[nextRoomId] ?? [];
        const normalizedServerSettings = normalizeServerSettings(
          state.serverSettingsBySpaceId[spaceId] ?? null
        );
        const nextUsers = withAppliedServerRoles(state.users, normalizedServerSettings);
        const nextMe = nextUsers.find((user) => user.id === state.me.id) ?? state.me;
        return {
          currentSpaceId: spaceId,
          currentRoomId: nextRoomId,
          users: nextUsers,
          me: nextMe,
          spaceStateHostRoomIdBySpaceId: {
            ...state.spaceStateHostRoomIdBySpaceId,
            [spaceId]: nextRoomId
          },
          categoriesBySpaceId: {
            ...state.categoriesBySpaceId,
            [spaceId]: layoutToCategories(
              hydrateLayoutForRooms(
                state.spaceLayoutsBySpaceId[spaceId] ?? null,
                state.rooms.filter((room) => room.spaceId === spaceId)
              )
            )
          },
          spaceLayoutsBySpaceId: {
            ...state.spaceLayoutsBySpaceId,
            [spaceId]: hydrateLayoutForRooms(
              state.spaceLayoutsBySpaceId[spaceId] ?? null,
              state.rooms.filter((room) => room.spaceId === spaceId)
            )
          },
          serverSettingsBySpaceId: {
            ...state.serverSettingsBySpaceId,
            [spaceId]: normalizedServerSettings
          },
          permissionOverridesBySpaceId: {
            ...state.permissionOverridesBySpaceId,
            [spaceId]: normalizePermissionOverrides(state.permissionOverridesBySpaceId[spaceId] ?? null)
          },
          moderationAuditBySpaceId: {
            ...state.moderationAuditBySpaceId,
            [spaceId]: normalizeAuditEvents(state.moderationAuditBySpaceId[spaceId] ?? [])
          },
          roomLastReadTsByRoomId: {
            ...state.roomLastReadTsByRoomId,
            [nextRoomId]: getLatestMessageTimestamp(nextRoomMessages)
          },
          rooms: state.rooms.map((room) =>
            room.id === nextRoomId ? { ...room, unreadCount: 0 } : room
          )
        };
      });
      return;
    }

    const { spaces, children } = buildSpaceIndex(client, DEFAULT_SPACE);
    const directRoomIds = getDirectRoomIds(client);
    const availableSpaces = spaces.length ? spaces : [DEFAULT_SPACE];
    const targetSpace = availableSpaces.find((space) => space.id === spaceId) ?? availableSpaces[0];
    const mappedRooms = client
      .getRooms()
      .filter((room) => room.getType() !== "m.space")
      .filter((room) => {
        const currentUserId = client.getUserId() ?? "";
        const membership =
          typeof room.getMyMembership === "function"
            ? room.getMyMembership()
            : typeof room.getMember === "function"
              ? room.getMember(currentUserId)?.membership
              : undefined;
        return membership === "join" || membership === "invite";
      })
      .filter((room) => !isRoomDeleted(room))
      .filter((room) => {
        if (targetSpace.id === DEFAULT_SPACE.id && spaces.length === 0) return true;
        const allowed = children.get(targetSpace.id);
        if (!allowed || allowed.size === 0) return true;
        return allowed.has(room.roomId);
      })
      .map((room) => mapMatrixRoom(client, room, targetSpace.id, directRoomIds));

    const spaceStateHostRoomId =
      targetSpace.id === DEFAULT_SPACE.id
        ? mappedRooms.find((room) => room.type !== "dm")?.id ?? mappedRooms[0]?.id ?? null
        : targetSpace.id;
    const spaceStateHostRoom = spaceStateHostRoomId ? client.getRoom(spaceStateHostRoomId) : null;

    const parsedLayout = parseSpaceLayout(spaceStateHostRoom);
    const hydratedLayout = hydrateLayoutForRooms(parsedLayout, mappedRooms);
    const parsedServerSettings = parseServerSettings(spaceStateHostRoom);
    const parsedPermissionOverrides = parsePermissionOverrides(spaceStateHostRoom);
    const parsedModerationAudit = parseModerationAudit(spaceStateHostRoom);
    const parsedServerMetaName = parseServerMetaName(spaceStateHostRoom);
    const rooms = applyLayoutToRooms(mappedRooms, hydratedLayout);
    const categories = layoutToCategories(hydratedLayout);
    const serverSettings = normalizeServerSettings(
      parsedServerSettings ?? get().serverSettingsBySpaceId[targetSpace.id] ?? null
    );
    const permissionOverrides = normalizePermissionOverrides(
      parsedPermissionOverrides ?? get().permissionOverridesBySpaceId[targetSpace.id] ?? null
    );
    const moderationAudit = normalizeAuditEvents(
      parsedModerationAudit ?? get().moderationAuditBySpaceId[targetSpace.id] ?? []
    );
    const nextSpaces = availableSpaces.map((space) => {
      if (space.id !== targetSpace.id) return space;
      const nextName = parsedServerMetaName ?? space.name;
      return {
        ...space,
        name: nextName,
        icon: (nextName || space.icon || "S").slice(0, 1).toUpperCase()
      };
    });

    const nextRoomId = rooms[0]?.id ?? "";
    set((state) => ({
      spaces: nextSpaces,
      rooms,
      currentSpaceId: targetSpace.id,
      currentRoomId: nextRoomId,
      categoriesBySpaceId: {
        ...state.categoriesBySpaceId,
        [targetSpace.id]: categories
      },
      spaceLayoutsBySpaceId: {
        ...state.spaceLayoutsBySpaceId,
        [targetSpace.id]: hydratedLayout
      },
      spaceStateHostRoomIdBySpaceId: {
        ...state.spaceStateHostRoomIdBySpaceId,
        [targetSpace.id]: spaceStateHostRoomId ?? ""
      },
      serverSettingsBySpaceId: {
        ...state.serverSettingsBySpaceId,
        [targetSpace.id]: serverSettings
      },
      permissionOverridesBySpaceId: {
        ...state.permissionOverridesBySpaceId,
        [targetSpace.id]: permissionOverrides
      },
      moderationAuditBySpaceId: {
        ...state.moderationAuditBySpaceId,
        [targetSpace.id]: moderationAudit
      },
      roomLastReadTsByRoomId: nextRoomId
        ? {
            ...state.roomLastReadTsByRoomId,
            [nextRoomId]: getLatestMessageTimestamp(state.messagesByRoomId[nextRoomId] ?? [])
          }
        : state.roomLastReadTsByRoomId
    }));

    if (nextRoomId) {
      get().selectRoom(nextRoomId);
    }
  },
  selectRoom: (roomId) => {
    const client = get().matrixClient;
    if (!client) {
      set((state) => {
        const roomMessages = state.messagesByRoomId[roomId] ?? [];
        return {
          currentRoomId: roomId,
          replyToId: null,
          threadRootId: null,
          showThread: false,
          historyHasMoreByRoomId: {
            ...state.historyHasMoreByRoomId,
            [roomId]: true
          },
          roomLastReadTsByRoomId: {
            ...state.roomLastReadTsByRoomId,
            [roomId]: getLatestMessageTimestamp(roomMessages)
          },
          rooms: state.rooms.map((room) =>
            room.id === roomId ? { ...room, unreadCount: 0 } : room
          )
        };
      });
      return;
    }

    const room = client.getRoom(roomId);
    if (!room) return;

    const timelineMessages = mapEventsToMessages(client, room);
    const members = mapMembers(client, room);
    const meMember = members.find((member) => member.id === client.getUserId());

    set((state) => ({
      ...(() => {
        const fallbackMe = meMember ?? state.me;
        const nextMe = applyProfileToUser(
          fallbackMe,
          state.profileDisplayName,
          state.profileAvatarDataUrl
        );
        const nextUsers = applyProfileToUsers(
          members,
          nextMe.id,
          state.profileDisplayName,
          state.profileAvatarDataUrl
        );
        const roomSpaceId =
          state.rooms.find((roomItem) => roomItem.id === roomId)?.spaceId ?? state.currentSpaceId;
        const roomServerSettings = normalizeServerSettings(state.serverSettingsBySpaceId[roomSpaceId] ?? null);
        const nextUsersWithRoles = withAppliedServerRoles(nextUsers, roomServerSettings);
        const nextMeWithRoles = nextUsersWithRoles.find((user) => user.id === nextMe.id) ?? nextMe;
        return {
          users: nextUsersWithRoles,
          me: nextMeWithRoles
        };
      })(),
      currentRoomId: roomId,
      replyToId: null,
      threadRootId: null,
      showThread: false,
      messagesByRoomId: {
        ...state.messagesByRoomId,
        [roomId]: resolveTimelineMessages({
          existingMessages: state.messagesByRoomId[roomId] ?? [],
          timelineMessages
        })
      },
      historyHasMoreByRoomId: {
        ...state.historyHasMoreByRoomId,
        [roomId]: true
      },
      roomLastReadTsByRoomId: {
        ...state.roomLastReadTsByRoomId,
        [roomId]: getLatestMessageTimestamp(
          resolveTimelineMessages({
            existingMessages: state.messagesByRoomId[roomId] ?? [],
            timelineMessages
          })
        )
      },
      rooms: state.rooms.map((roomItem) =>
        roomItem.id === roomId ? { ...roomItem, unreadCount: 0 } : roomItem
      )
    }));
    reconcilePendingRedactionsForRoom({
      room,
      currentRoomId: roomId,
      redactMessage: get().redactMessage
    });

    if (timelineMessages.length === 0) {
      void (async () => {
        try {
          const { messages, hasMore } = await loadRoomMessagesWithBackfill(client, room);
          if (messages.length === 0) return;
          set((state) => {
            if (state.currentRoomId !== roomId) {
              return {};
            }
            return {
              messagesByRoomId: {
                ...state.messagesByRoomId,
                [roomId]: messages
              },
              historyHasMoreByRoomId: {
                ...state.historyHasMoreByRoomId,
                [roomId]: hasMore
              },
              roomLastReadTsByRoomId: {
                ...state.roomLastReadTsByRoomId,
                [roomId]: getLatestMessageTimestamp(messages)
              }
            };
          });
          reconcilePendingRedactionsForRoom({
            room,
            currentRoomId: get().currentRoomId,
            redactMessage: get().redactMessage
          });
        } catch (error) {
          console.warn("Failed to backfill room messages after empty timeline load", error);
        }
      })();
    }
  },
  toggleMembers: () => set((state) => ({ showMembers: !state.showMembers })),
  toggleThread: (rootId) =>
    set((state) => {
      if (rootId === null) {
        return { showThread: false, threadRootId: null };
      }
      if (typeof rootId === "string") {
        const threadMessages = (state.messagesByRoomId[state.currentRoomId] ?? [])
          .filter((message) => message.threadRootId === rootId)
          .sort((left, right) => left.timestamp - right.timestamp);
        const latestThreadTimestamp = threadMessages.length
          ? threadMessages[threadMessages.length - 1]?.timestamp ?? Date.now()
          : Date.now();
        return {
          showThread: true,
          threadRootId: rootId,
          threadLastViewedTsByRoomId: {
            ...state.threadLastViewedTsByRoomId,
            [state.currentRoomId]: {
              ...(state.threadLastViewedTsByRoomId[state.currentRoomId] ?? {}),
              [rootId]: latestThreadTimestamp
            }
          }
        };
      }
      return { showThread: !state.showThread };
    }),
  togglePins: () => set((state) => ({ showPins: !state.showPins })),
  openServerSettings: (tab = "overview") =>
    set({ showServerSettings: true, serverSettingsTab: tab }),
  closeServerSettings: () => set({ showServerSettings: false }),
  setServerSettingsTab: (tab) => set({ serverSettingsTab: tab }),
  setSearchQuery: (value) => set({ searchQuery: value }),
  setTheme: (value) => {
    savePreferences({ ...toPreferencesFromState(get()), theme: value });
    trackLocalMetricEvent("settings_completion", { setting: "theme", value });
    set({ theme: value });
  },
  setOnline: (value) => set({ isOnline: value }),
  dismissNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((notification) => notification.id !== id)
    })),
  pushNotification: (title, body, options) =>
    set((state) => ({
      notifications: [createNotification(title, body, options), ...state.notifications]
    })),
  setComposerEnterToSend: (value) => {
    savePreferences({ ...toPreferencesFromState(get()), composerEnterToSend: value });
    trackLocalMetricEvent("settings_completion", { setting: "composerEnterToSend", value });
    set({ composerEnterToSend: value });
  },
  setMessageDensity: (value) => {
    savePreferences({ ...toPreferencesFromState(get()), messageDensity: value });
    trackLocalMetricEvent("settings_completion", { setting: "messageDensity", value });
    set({ messageDensity: value });
  },
  setNotificationsEnabled: (value) => {
    savePreferences({ ...toPreferencesFromState(get()), notificationsEnabled: value });
    trackLocalMetricEvent("settings_completion", { setting: "notificationsEnabled", value });
    set({ notificationsEnabled: value });
  },
  setMentionsOnlyNotifications: (value) => {
    savePreferences({ ...toPreferencesFromState(get()), mentionsOnlyNotifications: value });
    trackLocalMetricEvent("settings_completion", { setting: "mentionsOnlyNotifications", value });
    set({ mentionsOnlyNotifications: value });
  },
  setKeybindsEnabled: (value) => {
    savePreferences({ ...toPreferencesFromState(get()), keybindsEnabled: value });
    trackLocalMetricEvent("settings_completion", { setting: "keybindsEnabled", value });
    set({ keybindsEnabled: value });
  },
  setComposerSpellcheck: (value) => {
    savePreferences({ ...toPreferencesFromState(get()), composerSpellcheck: value });
    trackLocalMetricEvent("settings_completion", { setting: "composerSpellcheck", value });
    set({ composerSpellcheck: value });
  },
  setReducedMotion: (value) => {
    savePreferences({ ...toPreferencesFromState(get()), reducedMotion: value });
    trackLocalMetricEvent("settings_completion", { setting: "reducedMotion", value });
    set({ reducedMotion: value });
  },
  setHighContrast: (value) => {
    savePreferences({ ...toPreferencesFromState(get()), highContrast: value });
    trackLocalMetricEvent("settings_completion", { setting: "highContrast", value });
    set({ highContrast: value });
  },
  setFontScale: (value) => {
    savePreferences({ ...toPreferencesFromState(get()), fontScale: value });
    trackLocalMetricEvent("settings_completion", { setting: "fontScale", value });
    set({ fontScale: value });
  },
  setProfileDisplayName: (value) => {
    const trimmed = value.trim().slice(0, 32);
    const current = get();
    savePreferences({ ...toPreferencesFromState(current), profileDisplayName: trimmed });
    trackLocalMetricEvent("settings_completion", { setting: "profileDisplayName", value: Boolean(trimmed) });
    set((state) => {
      const nextMe = applyProfileToUser(state.me, trimmed, state.profileAvatarDataUrl);
      return {
        profileDisplayName: trimmed,
        me: nextMe,
        users: applyProfileToUsers(state.users, nextMe.id, trimmed, state.profileAvatarDataUrl)
      };
    });

    const client = get().matrixClient;
    if (client && trimmed) {
      client.setDisplayName(trimmed).catch((error) => {
        console.warn("Unable to sync display name to Matrix profile", error);
      });
    }
  },
  setProfileAbout: (value) => {
    const trimmed = value.trim().slice(0, 190);
    savePreferences({ ...toPreferencesFromState(get()), profileAbout: trimmed });
    trackLocalMetricEvent("settings_completion", { setting: "profileAbout", value: Boolean(trimmed) });
    set({ profileAbout: trimmed });
  },
  setProfileAvatarDataUrl: (value) => {
    const sanitized = typeof value === "string" && value.startsWith("data:image") ? value : null;
    const current = get();
    savePreferences({ ...toPreferencesFromState(current), profileAvatarDataUrl: sanitized });
    trackLocalMetricEvent("settings_completion", { setting: "profileAvatar", value: Boolean(sanitized) });
    set((state) => {
      const nextMe = applyProfileToUser(state.me, state.profileDisplayName, sanitized);
      return {
        profileAvatarDataUrl: sanitized,
        me: nextMe,
        users: applyProfileToUsers(state.users, nextMe.id, state.profileDisplayName, sanitized)
      };
    });

    const client = get().matrixClient;
    if (!client) return;

    if (!sanitized) {
      client.setAvatarUrl("").catch((error) => {
        console.warn("Unable to clear Matrix avatar", error);
      });
      return;
    }

    (async () => {
      try {
        const response = await fetch(sanitized);
        const blob = await response.blob();
        const upload = await client.uploadContent(blob as any);
        const contentUri =
          typeof upload === "string"
            ? upload
            : (upload as { content_uri?: string }).content_uri;
        if (!contentUri) return;
        await client.setAvatarUrl(contentUri);
      } catch (error) {
        console.warn("Unable to sync avatar to Matrix profile", error);
      }
    })();
  },
  markRoomRead: (roomId) =>
    set((state) => {
      const targetRoomId = roomId ?? state.currentRoomId;
      if (!targetRoomId) return {};
      const roomMessages = state.messagesByRoomId[targetRoomId] ?? [];
      const nextReadTs = getLatestMessageTimestamp(roomMessages);
      return {
        roomLastReadTsByRoomId: {
          ...state.roomLastReadTsByRoomId,
          [targetRoomId]: nextReadTs
        },
        rooms: state.rooms.map((room) =>
          room.id === targetRoomId ? { ...room, unreadCount: 0 } : room
        )
      };
    }),
  sendMessage: async ({ body, attachments = [], threadRootId }) => {
    const client = get().matrixClient;
    const roomId = get().currentRoomId;
    const replyToId = get().replyToId ?? undefined;

    if (!client) {
      set((state) => {
        const timestamp = Date.now();
        const message: Message = {
          id: uid("m"),
          roomId,
          authorId: state.me.id,
          body,
          timestamp,
          reactions: [],
          attachments: attachments.length ? attachments : undefined,
          replyToId,
          threadRootId,
          status: state.isOnline ? "sent" : "queued"
        };
        const existing = state.messagesByRoomId[roomId] ?? [];
        const nextThreadViewed =
          typeof threadRootId === "string"
            ? {
                ...state.threadLastViewedTsByRoomId,
                [roomId]: {
                  ...(state.threadLastViewedTsByRoomId[roomId] ?? {}),
                  [threadRootId]: timestamp
                }
              }
            : state.threadLastViewedTsByRoomId;
        return {
          messagesByRoomId: { ...state.messagesByRoomId, [roomId]: [...existing, message] },
          replyToId: null,
          roomLastReadTsByRoomId: {
            ...state.roomLastReadTsByRoomId,
            [roomId]: timestamp
          },
          threadLastViewedTsByRoomId: nextThreadViewed,
          rooms: state.rooms.map((room) =>
            room.id === roomId ? { ...room, unreadCount: 0 } : room
          )
        };
      });
      trackLocalMetricEvent("message_send_success", {
        mode: "local",
        roomId,
        threaded: Boolean(threadRootId)
      });
      if (get().onboardingStep !== null && (body.trim() || attachments.length > 0)) {
        get().completeOnboarding();
      }
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

    trackLocalMetricEvent("message_send_success", {
      mode: "matrix",
      roomId,
      threaded: Boolean(threadRootId)
    });
    set({ replyToId: null });
    get().markRoomRead(roomId);

    if (threadRootId) {
      set((state) => ({
        threadLastViewedTsByRoomId: {
          ...state.threadLastViewedTsByRoomId,
          [roomId]: {
            ...(state.threadLastViewedTsByRoomId[roomId] ?? {}),
            [threadRootId]: Date.now()
          }
        }
      }));
    }
    if (get().onboardingStep !== null && (body.trim() || attachments.length > 0)) {
      get().completeOnboarding();
    }
  },
  createRoom: async ({ name, type, category }) => {
    const client = get().matrixClient;
    if (!client) {
      set((state) => {
        const spaceId = state.currentSpaceId;
        const categoryId = category?.trim() || DEFAULT_CATEGORY_ID;
        const room: Room = {
          id: uid("r"),
          spaceId,
          name,
          type,
          category: categoryId,
          topic: type === "voice" ? "Drop in voice channel" : type === "video" ? "Video + screen share" : "New text channel",
          unreadCount: 0
        };
        const existingSpaceRooms = getSpaceRooms(state.rooms, spaceId);
        const nextLayout = hydrateLayoutForRooms(
          state.spaceLayoutsBySpaceId[spaceId] ?? null,
          [...existingSpaceRooms, room]
        );
        const usedOrders = Object.values(nextLayout.rooms)
          .filter((placement) => placement.categoryId === categoryId)
          .map((placement) => placement.order);
        const nextOrder = usedOrders.length ? Math.max(...usedOrders) + 1 : 0;
        nextLayout.rooms[room.id] = { categoryId, order: nextOrder };
        if (!nextLayout.categories.some((entry) => entry.id === categoryId)) {
          nextLayout.categories = normalizeLayoutCategories([
            ...nextLayout.categories,
            {
              id: categoryId,
              name: categoryId === DEFAULT_CATEGORY_ID ? DEFAULT_CATEGORY_NAME : categoryId,
              order: nextLayout.categories.length
            }
          ]);
        }
        const nextRooms = applyLayoutToSpaceRooms([...state.rooms, room], spaceId, nextLayout);

        return {
          rooms: nextRooms,
          categoriesBySpaceId: {
            ...state.categoriesBySpaceId,
            [spaceId]: layoutToCategories(nextLayout)
          },
          spaceLayoutsBySpaceId: {
            ...state.spaceLayoutsBySpaceId,
            [spaceId]: nextLayout
          },
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
    if (category?.trim()) {
      await client.setRoomTag(room_id, category.trim(), { order: 0 });
    }

    const state = get();
    const logicalSpaceId = state.currentSpaceId;
    const spaceStateHostRoomId = resolveSpaceStateHostRoomId(state, logicalSpaceId);
    if (logicalSpaceId && spaceStateHostRoomId) {
      const existingLayout = state.spaceLayoutsBySpaceId[logicalSpaceId] ?? createDefaultLayout();
      const nextLayout = {
        ...existingLayout,
        categories: [...existingLayout.categories],
        rooms: { ...existingLayout.rooms }
      };
      const categoryId = category?.trim() || DEFAULT_CATEGORY_ID;
      if (!nextLayout.categories.some((entry) => entry.id === categoryId)) {
        nextLayout.categories = normalizeLayoutCategories([
          ...nextLayout.categories,
          {
            id: categoryId,
            name: categoryId === DEFAULT_CATEGORY_ID ? DEFAULT_CATEGORY_NAME : categoryId,
            order: nextLayout.categories.length
          }
        ]);
      }
      const usedOrders = Object.values(nextLayout.rooms)
        .filter((placement) => placement.categoryId === categoryId)
        .map((placement) => placement.order);
      nextLayout.rooms[room_id] = {
        categoryId,
        order: usedOrders.length ? Math.max(...usedOrders) + 1 : 0
      };

      try {
        await client.sendStateEvent(spaceStateHostRoomId, SPACE_LAYOUT_EVENT as any, nextLayout, "");
        set((current) => ({
          spaceLayoutsBySpaceId: {
            ...current.spaceLayoutsBySpaceId,
            [logicalSpaceId]: nextLayout
          },
          categoriesBySpaceId: {
            ...current.categoriesBySpaceId,
            [logicalSpaceId]: layoutToCategories(nextLayout)
          },
          spaceStateHostRoomIdBySpaceId: {
            ...current.spaceStateHostRoomIdBySpaceId,
            [logicalSpaceId]: spaceStateHostRoomId
          }
        }));
      } catch (error) {
        get().pushNotification("Failed to update channel layout", (error as Error).message);
      }
    }
    get().selectSpace(logicalSpaceId);
  },
  deleteRoom: async (roomId) => {
    const state = get();
    const room = state.rooms.find((candidate) => candidate.id === roomId);
    if (!room || room.type === "dm") return;

    const spaceId = room.spaceId;
    if (!canCurrentUserDeleteChannelsInSpace(state, spaceId, roomId)) {
      get().pushNotification(
        "Channel delete unavailable",
        "Only server admins or roles explicitly granted Manage Channels can delete channels."
      );
      return;
    }
    const spaceStateHostRoomId = resolveSpaceStateHostRoomId(
      { ...state, currentRoomId: roomId },
      spaceId
    );
    if (!spaceId || !spaceStateHostRoomId) {
      get().pushNotification(
        "Channel delete unavailable",
        "Select a server context before deleting channels."
      );
      return;
    }

    const categoryId = room.category ?? DEFAULT_CATEGORY_ID;
    const remainingSpaceRooms = getSpaceRooms(state.rooms, spaceId).filter(
      (candidate) => candidate.id !== roomId
    );
    const baseLayout = hydrateLayoutForRooms(state.spaceLayoutsBySpaceId[spaceId] ?? null, remainingSpaceRooms);
    const nextLayout: SpaceLayout = {
      ...baseLayout,
      categories: [...baseLayout.categories],
      rooms: { ...baseLayout.rooms }
    };

    const remainingRoomIds = getOrderedRoomIdsByCategory(nextLayout, categoryId).filter(
      (candidateRoomId) => candidateRoomId !== roomId
    );
    setRoomOrderForCategory(nextLayout, categoryId, remainingRoomIds);
    delete nextLayout.rooms[roomId];
    const fallbackHostRoomId =
      remainingSpaceRooms.find((candidate) => candidate.type !== "dm")?.id ??
      remainingSpaceRooms[0]?.id ??
      "";
    const currentStateHostRoomId = state.spaceStateHostRoomIdBySpaceId[spaceId];
    const layoutHostRoomId =
      currentStateHostRoomId === roomId ? fallbackHostRoomId : spaceStateHostRoomId;

    const client = state.matrixClient;
    if (client) {
      const session = state.matrixSession;
      if (!session?.accessToken || !session.baseUrl) {
        get().pushNotification(
          "Failed to permanently delete channel",
          "Missing Matrix session credentials for Synapse admin deletion."
        );
        return;
      }

      try {
        await requestSynapseHardDelete({
          baseUrl: session.baseUrl,
          accessToken: session.accessToken,
          roomId,
          requesterUserId: state.me.id
        });
      } catch (error) {
        get().pushNotification(
          "Failed to permanently delete channel",
          (error as Error).message
        );
        return;
      }

      if (layoutHostRoomId) {
        await client
          .sendStateEvent(layoutHostRoomId, SPACE_LAYOUT_EVENT as any, nextLayout, "")
          .catch((error) => {
            get().pushNotification(
              "Channel deleted with layout warning",
              `Room was deleted, but layout sync failed: ${(error as Error).message}`
            );
          });
      }
    }

    set((current) => {
      const nextRooms = current.rooms.filter((candidate) => candidate.id !== roomId);
      const nextSpaceRooms = getSpaceRooms(nextRooms, spaceId);
      const appliedRooms = applyLayoutToSpaceRooms(nextRooms, spaceId, nextLayout);
      const fallbackRoomId = nextSpaceRooms[0]?.id ?? appliedRooms[0]?.id ?? "";
      const nextFallbackHostRoomId =
        nextSpaceRooms.find((candidate) => candidate.type !== "dm")?.id ?? fallbackRoomId;
      const nextCurrentRoomId =
        current.currentRoomId === roomId ? fallbackRoomId : current.currentRoomId;
      const currentRoomWasDeleted = current.currentRoomId === roomId;
      const fallbackRoom = appliedRooms.find((candidate) => candidate.id === nextCurrentRoomId);
      const nextCurrentSpaceId = currentRoomWasDeleted
        ? fallbackRoom?.spaceId ?? current.currentSpaceId
        : current.currentSpaceId;
      const currentHostRoomId = current.spaceStateHostRoomIdBySpaceId[spaceId];
      const nextStateHostRoomId =
        currentHostRoomId === roomId ? nextFallbackHostRoomId : currentHostRoomId;
      const nextMessagesByRoomId = { ...current.messagesByRoomId };
      const nextRoomLastReadTsByRoomId = { ...current.roomLastReadTsByRoomId };
      const nextThreadLastViewedTsByRoomId = { ...current.threadLastViewedTsByRoomId };
      const nextHistoryLoadingByRoomId = { ...current.historyLoadingByRoomId };
      const nextHistoryHasMoreByRoomId = { ...current.historyHasMoreByRoomId };
      delete nextMessagesByRoomId[roomId];
      delete nextRoomLastReadTsByRoomId[roomId];
      delete nextThreadLastViewedTsByRoomId[roomId];
      delete nextHistoryLoadingByRoomId[roomId];
      delete nextHistoryHasMoreByRoomId[roomId];

      return {
        rooms: appliedRooms,
        currentSpaceId: nextCurrentSpaceId,
        currentRoomId: nextCurrentRoomId,
        replyToId: currentRoomWasDeleted ? null : current.replyToId,
        threadRootId: currentRoomWasDeleted ? null : current.threadRootId,
        showThread: currentRoomWasDeleted ? false : current.showThread,
        messagesByRoomId: nextMessagesByRoomId,
        roomLastReadTsByRoomId: nextRoomLastReadTsByRoomId,
        threadLastViewedTsByRoomId: nextThreadLastViewedTsByRoomId,
        historyLoadingByRoomId: nextHistoryLoadingByRoomId,
        historyHasMoreByRoomId: nextHistoryHasMoreByRoomId,
        categoriesBySpaceId: {
          ...current.categoriesBySpaceId,
          [spaceId]: layoutToCategories(nextLayout)
        },
        spaceLayoutsBySpaceId: {
          ...current.spaceLayoutsBySpaceId,
          [spaceId]: nextLayout
        },
        spaceStateHostRoomIdBySpaceId: {
          ...current.spaceStateHostRoomIdBySpaceId,
          [spaceId]: nextStateHostRoomId ?? ""
        }
      };
    });

    if (client) {
      await client.leave(roomId).catch(() => undefined);
      await client.forget(roomId).catch(() => undefined);
    }

    get().pushNotification("Channel deleted", `${room.name} was permanently removed.`);
  },
  createSpace: async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const client = get().matrixClient;
    if (!client) {
      const space: Space = {
        id: uid("s"),
        name: trimmed,
        icon: trimmed.slice(0, 1).toUpperCase() || "S"
      };
      const defaultLayout = createDefaultLayout();
      const defaultSettings = createDefaultServerSettings();
      const defaultPermissionOverrides = createDefaultPermissionOverrides();
      set((state) => ({
        spaces: [...state.spaces, space],
        currentSpaceId: space.id,
        currentRoomId: state.rooms.find((room) => room.spaceId === space.id)?.id ?? "",
        categoriesBySpaceId: {
          ...state.categoriesBySpaceId,
          [space.id]: layoutToCategories(defaultLayout)
        },
        spaceLayoutsBySpaceId: {
          ...state.spaceLayoutsBySpaceId,
          [space.id]: defaultLayout
        },
        serverSettingsBySpaceId: {
          ...state.serverSettingsBySpaceId,
          [space.id]: defaultSettings
        },
        permissionOverridesBySpaceId: {
          ...state.permissionOverridesBySpaceId,
          [space.id]: defaultPermissionOverrides
        },
        moderationAuditBySpaceId: {
          ...state.moderationAuditBySpaceId,
          [space.id]: []
        }
      }));
      return;
    }

    try {
      const { room_id } = await client.createRoom({
        name: trimmed,
        creation_content: { type: "m.space" },
        preset: Preset.PrivateChat
      });
      const defaultLayout = createDefaultLayout();
      const defaultSettings = createDefaultServerSettings();
      const defaultPermissionOverrides = createDefaultPermissionOverrides();

      set((state) => ({
        spaces: [
          ...state.spaces.filter((space) => space.id !== room_id),
          {
            id: room_id,
            name: trimmed,
            icon: trimmed.slice(0, 1).toUpperCase() || "S"
          }
        ],
        categoriesBySpaceId: {
          ...state.categoriesBySpaceId,
          [room_id]: layoutToCategories(defaultLayout)
        },
        spaceLayoutsBySpaceId: {
          ...state.spaceLayoutsBySpaceId,
          [room_id]: defaultLayout
        },
        serverSettingsBySpaceId: {
          ...state.serverSettingsBySpaceId,
          [room_id]: defaultSettings
        },
        permissionOverridesBySpaceId: {
          ...state.permissionOverridesBySpaceId,
          [room_id]: defaultPermissionOverrides
        },
        moderationAuditBySpaceId: {
          ...state.moderationAuditBySpaceId,
          [room_id]: []
        }
      }));

      try {
        await client.sendStateEvent(room_id, SPACE_LAYOUT_EVENT as any, defaultLayout, "");
        await client.sendStateEvent(room_id, SERVER_SETTINGS_EVENT as any, defaultSettings, "");
        await client.sendStateEvent(
          room_id,
          PERMISSION_OVERRIDES_EVENT as any,
          defaultPermissionOverrides,
          ""
        );
        await client.sendStateEvent(room_id, AUDIT_LOG_EVENT as any, { version: 1, events: [] }, "");
      } catch (error) {
        get().pushNotification("Server created with defaults", (error as Error).message);
      }

      get().selectSpace(room_id);
    } catch (error) {
      get().pushNotification("Unable to create server", (error as Error).message);
    }
  },
  renameSpace: async (spaceId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const state = get();
    const spaceStateHostRoomId = resolveSpaceStateHostRoomId(state, spaceId);
    if (!spaceStateHostRoomId) {
      get().pushNotification("Unable to rename server", "No server context host room found.");
      return;
    }

    const nextSpace = { id: spaceId, name: trimmed, icon: trimmed.slice(0, 1).toUpperCase() || "S" };
    const client = state.matrixClient;
    if (!client) {
      set((state) => ({
        spaces: state.spaces.map((space) =>
          space.id === spaceId ? { ...space, ...nextSpace } : space
        ),
        spaceStateHostRoomIdBySpaceId: {
          ...state.spaceStateHostRoomIdBySpaceId,
          [spaceId]: spaceStateHostRoomId
        }
      }));
      return;
    }

    try {
      const renameAsRoomName = spaceId !== DEFAULT_SPACE.id && spaceStateHostRoomId === spaceId;
      if (renameAsRoomName) {
        await client.setRoomName(spaceId, trimmed);
      } else {
        await client.sendStateEvent(spaceStateHostRoomId, SERVER_META_EVENT as any, { name: trimmed }, "");
      }
      set((state) => ({
        spaces: state.spaces.map((space) =>
          space.id === spaceId ? { ...space, ...nextSpace } : space
        ),
        spaceStateHostRoomIdBySpaceId: {
          ...state.spaceStateHostRoomIdBySpaceId,
          [spaceId]: spaceStateHostRoomId
        }
      }));
    } catch (error) {
      get().pushNotification("Unable to rename server", (error as Error).message);
    }
  },
  saveServerSettings: async (spaceId, settings) => {
    if (!spaceId) return;
    const normalized = normalizeServerSettings(settings);
    const state = get();
    const spaceStateHostRoomId = resolveSpaceStateHostRoomId(state, spaceId);
    if (!spaceStateHostRoomId) return;
    const client = state.matrixClient;

    if (client) {
      try {
        await client.sendStateEvent(spaceStateHostRoomId, SERVER_SETTINGS_EVENT as any, normalized, "");
      } catch (error) {
        get().pushNotification("Failed to save server settings", (error as Error).message);
        return;
      }
    }

    set((state) => {
      const shouldApplyRoles = state.currentSpaceId === spaceId;
      const nextUsers = shouldApplyRoles ? withAppliedServerRoles(state.users, normalized) : state.users;
      const me = nextUsers.find((user) => user.id === state.me.id) ?? state.me;
      return {
        users: nextUsers,
        me,
        serverSettingsBySpaceId: {
          ...state.serverSettingsBySpaceId,
          [spaceId]: normalized
        },
        spaceStateHostRoomIdBySpaceId: {
          ...state.spaceStateHostRoomIdBySpaceId,
          [spaceId]: spaceStateHostRoomId
        }
      };
    });
  },
  setCategoryPermissionRule: async (categoryId, action, rule) => {
    const state = get();
    const spaceId = state.currentSpaceId;
    if (!spaceId) return;
    const spaceStateHostRoomId = resolveSpaceStateHostRoomId(state, spaceId);
    if (!spaceStateHostRoomId) return;
    const client = state.matrixClient;
    const base = normalizePermissionOverrides(state.permissionOverridesBySpaceId[spaceId] ?? null);
    const nextOverrides: SpacePermissionOverrides = {
      ...base,
      categories: { ...base.categories },
      rooms: { ...base.rooms }
    };
    const nextCategoryRules = { ...(nextOverrides.categories[categoryId] ?? {}) };
    if (rule === "inherit") {
      delete nextCategoryRules[action];
    } else {
      nextCategoryRules[action] = rule;
    }
    if (Object.keys(nextCategoryRules).length) {
      nextOverrides.categories[categoryId] = nextCategoryRules;
    } else {
      delete nextOverrides.categories[categoryId];
    }

    if (client) {
      try {
        await client.sendStateEvent(spaceStateHostRoomId, PERMISSION_OVERRIDES_EVENT as any, nextOverrides, "");
      } catch (error) {
        get().pushNotification("Failed to update category permissions", (error as Error).message);
        return;
      }
    }

    const nextAuditEntry: ModerationAuditEvent = {
      id: uid("audit"),
      action: "permission.category.update",
      actorId: state.me.id,
      target: `${categoryId}:${action}:${rule}`,
      timestamp: Date.now()
    };
    const nextAudit = [nextAuditEntry, ...(state.moderationAuditBySpaceId[spaceId] ?? [])].slice(0, 250);
    if (client) {
      await client
        .sendStateEvent(spaceStateHostRoomId, AUDIT_LOG_EVENT as any, { version: 1, events: nextAudit }, "")
        .catch(() => undefined);
    }

    set((current) => ({
      permissionOverridesBySpaceId: {
        ...current.permissionOverridesBySpaceId,
        [spaceId]: nextOverrides
      },
      moderationAuditBySpaceId: {
        ...current.moderationAuditBySpaceId,
        [spaceId]: nextAudit
      }
    }));
  },
  setRoomPermissionRule: async (roomId, action, rule) => {
    const state = get();
    const spaceId = state.currentSpaceId;
    if (!spaceId) return;
    const spaceStateHostRoomId = resolveSpaceStateHostRoomId(state, spaceId);
    if (!spaceStateHostRoomId) return;
    const client = state.matrixClient;
    const base = normalizePermissionOverrides(state.permissionOverridesBySpaceId[spaceId] ?? null);
    const nextOverrides: SpacePermissionOverrides = {
      ...base,
      categories: { ...base.categories },
      rooms: { ...base.rooms }
    };
    const nextRoomRules = { ...(nextOverrides.rooms[roomId] ?? {}) };
    if (rule === "inherit") {
      delete nextRoomRules[action];
    } else {
      nextRoomRules[action] = rule;
    }
    if (Object.keys(nextRoomRules).length) {
      nextOverrides.rooms[roomId] = nextRoomRules;
    } else {
      delete nextOverrides.rooms[roomId];
    }

    if (client) {
      try {
        await client.sendStateEvent(spaceStateHostRoomId, PERMISSION_OVERRIDES_EVENT as any, nextOverrides, "");
      } catch (error) {
        get().pushNotification("Failed to update room permissions", (error as Error).message);
        return;
      }
    }

    const nextAuditEntry: ModerationAuditEvent = {
      id: uid("audit"),
      action: "permission.room.update",
      actorId: state.me.id,
      target: `${roomId}:${action}:${rule}`,
      timestamp: Date.now()
    };
    const nextAudit = [nextAuditEntry, ...(state.moderationAuditBySpaceId[spaceId] ?? [])].slice(0, 250);
    if (client) {
      await client
        .sendStateEvent(spaceStateHostRoomId, AUDIT_LOG_EVENT as any, { version: 1, events: nextAudit }, "")
        .catch(() => undefined);
    }

    set((current) => ({
      permissionOverridesBySpaceId: {
        ...current.permissionOverridesBySpaceId,
        [spaceId]: nextOverrides
      },
      moderationAuditBySpaceId: {
        ...current.moderationAuditBySpaceId,
        [spaceId]: nextAudit
      }
    }));
  },
  createCategory: async (name) => {
    const state = get();
    const spaceId = state.currentSpaceId;
    if (!spaceId) return;
    const spaceStateHostRoomId = resolveSpaceStateHostRoomId(state, spaceId);
    if (!spaceStateHostRoomId) return;
    const trimmed = normalizeCategoryName(name);
    const client = state.matrixClient;
    const spaceRooms = getSpaceRooms(state.rooms, spaceId);
    const baseLayout = hydrateLayoutForRooms(state.spaceLayoutsBySpaceId[spaceId] ?? null, spaceRooms);
    const nextLayout: SpaceLayout = {
      ...baseLayout,
      categories: [...baseLayout.categories],
      rooms: { ...baseLayout.rooms }
    };

    let categoryId = toCategoryId(trimmed);
    let suffix = 1;
    while (nextLayout.categories.some((category) => category.id === categoryId)) {
      suffix += 1;
      categoryId = `${toCategoryId(trimmed)}-${suffix}`;
    }

    nextLayout.categories = normalizeLayoutCategories([
      ...nextLayout.categories,
      { id: categoryId, name: trimmed, order: nextLayout.categories.length }
    ]);

    if (client) {
      try {
        await client.sendStateEvent(spaceStateHostRoomId, SPACE_LAYOUT_EVENT as any, nextLayout, "");
      } catch (error) {
        get().pushNotification("Failed to create category", (error as Error).message);
        return;
      }
    }

    set((current) => ({
      spaceLayoutsBySpaceId: {
        ...current.spaceLayoutsBySpaceId,
        [spaceId]: nextLayout
      },
      categoriesBySpaceId: {
        ...current.categoriesBySpaceId,
        [spaceId]: layoutToCategories(nextLayout)
      },
      rooms: applyLayoutToSpaceRooms(current.rooms, spaceId, nextLayout)
    }));
  },
  renameCategory: async (categoryId, name) => {
    const state = get();
    const spaceId = state.currentSpaceId;
    if (!spaceId) return;
    const spaceStateHostRoomId = resolveSpaceStateHostRoomId(state, spaceId);
    if (!spaceStateHostRoomId) return;
    const trimmed = normalizeCategoryName(name);
    const client = state.matrixClient;
    const spaceRooms = getSpaceRooms(state.rooms, spaceId);
    const baseLayout = hydrateLayoutForRooms(state.spaceLayoutsBySpaceId[spaceId] ?? null, spaceRooms);
    if (!baseLayout.categories.some((category) => category.id === categoryId)) return;

    const nextLayout: SpaceLayout = {
      ...baseLayout,
      categories: normalizeLayoutCategories(
        baseLayout.categories.map((category) =>
          category.id === categoryId ? { ...category, name: trimmed } : category
        )
      ),
      rooms: { ...baseLayout.rooms }
    };

    if (client) {
      try {
        await client.sendStateEvent(spaceStateHostRoomId, SPACE_LAYOUT_EVENT as any, nextLayout, "");
      } catch (error) {
        get().pushNotification("Failed to rename category", (error as Error).message);
        return;
      }
    }

    set((current) => ({
      spaceLayoutsBySpaceId: {
        ...current.spaceLayoutsBySpaceId,
        [spaceId]: nextLayout
      },
      categoriesBySpaceId: {
        ...current.categoriesBySpaceId,
        [spaceId]: layoutToCategories(nextLayout)
      },
      rooms: applyLayoutToSpaceRooms(current.rooms, spaceId, nextLayout)
    }));
  },
  deleteCategory: async (categoryId) => {
    if (categoryId === DEFAULT_CATEGORY_ID) return;
    const state = get();
    const spaceId = state.currentSpaceId;
    if (!spaceId) return;
    if (!canCurrentUserDeleteChannelsInSpace(state, spaceId, state.currentRoomId)) {
      get().pushNotification(
        "Category delete unavailable",
        "Only server admins or roles explicitly granted Manage Channels can delete categories."
      );
      return;
    }
    const spaceStateHostRoomId = resolveSpaceStateHostRoomId(state, spaceId);
    if (!spaceStateHostRoomId) return;
    const client = state.matrixClient;
    const spaceRooms = getSpaceRooms(state.rooms, spaceId);
    const baseLayout = hydrateLayoutForRooms(state.spaceLayoutsBySpaceId[spaceId] ?? null, spaceRooms);
    if (!baseLayout.categories.some((category) => category.id === categoryId)) return;

    const nextLayout: SpaceLayout = {
      ...baseLayout,
      categories: normalizeLayoutCategories(
        baseLayout.categories.filter((category) => category.id !== categoryId)
      ),
      rooms: { ...baseLayout.rooms }
    };

    const movedRoomIds = getOrderedRoomIdsByCategory(nextLayout, categoryId);
    const defaultRoomIds = getOrderedRoomIdsByCategory(nextLayout, DEFAULT_CATEGORY_ID);
    setRoomOrderForCategory(nextLayout, DEFAULT_CATEGORY_ID, [...defaultRoomIds, ...movedRoomIds]);

    if (client) {
      try {
        await client.sendStateEvent(spaceStateHostRoomId, SPACE_LAYOUT_EVENT as any, nextLayout, "");
      } catch (error) {
        get().pushNotification("Failed to delete category", (error as Error).message);
        return;
      }
    }

    set((current) => ({
      spaceLayoutsBySpaceId: {
        ...current.spaceLayoutsBySpaceId,
        [spaceId]: nextLayout
      },
      categoriesBySpaceId: {
        ...current.categoriesBySpaceId,
        [spaceId]: layoutToCategories(nextLayout)
      },
      rooms: applyLayoutToSpaceRooms(current.rooms, spaceId, nextLayout)
    }));
  },
  moveCategoryByStep: async (categoryId, direction) => {
    if (categoryId === DEFAULT_CATEGORY_ID) return;
    const state = get();
    const spaceId = state.currentSpaceId;
    if (!spaceId) return;
    const spaceStateHostRoomId = resolveSpaceStateHostRoomId(state, spaceId);
    if (!spaceStateHostRoomId) return;
    const client = state.matrixClient;
    const spaceRooms = getSpaceRooms(state.rooms, spaceId);
    const baseLayout = hydrateLayoutForRooms(state.spaceLayoutsBySpaceId[spaceId] ?? null, spaceRooms);
    const categories = normalizeLayoutCategories(baseLayout.categories);
    const sourceIndex = categories.findIndex((category) => category.id === categoryId);
    if (sourceIndex < 0) return;
    const targetIndex = direction === "up" ? sourceIndex - 1 : sourceIndex + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;
    if (categories[targetIndex]?.id === DEFAULT_CATEGORY_ID) return;

    const reordered = moveItem(categories, sourceIndex, targetIndex).map((category, index) => ({
      ...category,
      order: index
    }));
    const nextLayout: SpaceLayout = {
      ...baseLayout,
      categories: normalizeLayoutCategories(reordered),
      rooms: { ...baseLayout.rooms }
    };

    if (client) {
      try {
        await client.sendStateEvent(spaceStateHostRoomId, SPACE_LAYOUT_EVENT as any, nextLayout, "");
      } catch (error) {
        get().pushNotification("Failed to move category", (error as Error).message);
        return;
      }
    }

    set((current) => ({
      spaceLayoutsBySpaceId: {
        ...current.spaceLayoutsBySpaceId,
        [spaceId]: nextLayout
      },
      categoriesBySpaceId: {
        ...current.categoriesBySpaceId,
        [spaceId]: layoutToCategories(nextLayout)
      },
      rooms: applyLayoutToSpaceRooms(current.rooms, spaceId, nextLayout)
    }));
  },
  reorderCategory: async (sourceCategoryId, targetCategoryId) => {
    if (sourceCategoryId === targetCategoryId) return;
    if (sourceCategoryId === DEFAULT_CATEGORY_ID || targetCategoryId === DEFAULT_CATEGORY_ID) return;
    const state = get();
    const spaceId = state.currentSpaceId;
    if (!spaceId) return;
    const spaceStateHostRoomId = resolveSpaceStateHostRoomId(state, spaceId);
    if (!spaceStateHostRoomId) return;
    const client = state.matrixClient;
    const spaceRooms = getSpaceRooms(state.rooms, spaceId);
    const baseLayout = hydrateLayoutForRooms(state.spaceLayoutsBySpaceId[spaceId] ?? null, spaceRooms);
    const categories = normalizeLayoutCategories(baseLayout.categories);
    const sourceIndex = categories.findIndex((category) => category.id === sourceCategoryId);
    const targetIndex = categories.findIndex((category) => category.id === targetCategoryId);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const reordered = moveItem(categories, sourceIndex, targetIndex).map((category, index) => ({
      ...category,
      order: index
    }));
    const nextLayout: SpaceLayout = {
      ...baseLayout,
      categories: normalizeLayoutCategories(reordered),
      rooms: { ...baseLayout.rooms }
    };

    if (client) {
      try {
        await client.sendStateEvent(spaceStateHostRoomId, SPACE_LAYOUT_EVENT as any, nextLayout, "");
      } catch (error) {
        get().pushNotification("Failed to reorder categories", (error as Error).message);
        return;
      }
    }

    set((current) => ({
      spaceLayoutsBySpaceId: {
        ...current.spaceLayoutsBySpaceId,
        [spaceId]: nextLayout
      },
      categoriesBySpaceId: {
        ...current.categoriesBySpaceId,
        [spaceId]: layoutToCategories(nextLayout)
      },
      rooms: applyLayoutToSpaceRooms(current.rooms, spaceId, nextLayout)
    }));
  },
  moveRoomByStep: async (roomId, direction) => {
    const state = get();
    const spaceId = state.currentSpaceId;
    if (!spaceId) return;
    const spaceStateHostRoomId = resolveSpaceStateHostRoomId(state, spaceId);
    if (!spaceStateHostRoomId) return;
    const client = state.matrixClient;
    const spaceRooms = getSpaceRooms(state.rooms, spaceId);
    const baseLayout = hydrateLayoutForRooms(state.spaceLayoutsBySpaceId[spaceId] ?? null, spaceRooms);
    const placement = baseLayout.rooms[roomId];
    if (!placement) return;

    const roomIds = getOrderedRoomIdsByCategory(baseLayout, placement.categoryId);
    const sourceIndex = roomIds.indexOf(roomId);
    if (sourceIndex < 0) return;
    const targetIndex = direction === "up" ? sourceIndex - 1 : sourceIndex + 1;
    if (targetIndex < 0 || targetIndex >= roomIds.length) return;

    const reordered = moveItem(roomIds, sourceIndex, targetIndex);
    const nextLayout: SpaceLayout = {
      ...baseLayout,
      categories: [...baseLayout.categories],
      rooms: { ...baseLayout.rooms }
    };
    setRoomOrderForCategory(nextLayout, placement.categoryId, reordered);

    if (client) {
      try {
        await client.sendStateEvent(spaceStateHostRoomId, SPACE_LAYOUT_EVENT as any, nextLayout, "");
      } catch (error) {
        get().pushNotification("Failed to move channel", (error as Error).message);
        return;
      }
    }

    set((current) => ({
      spaceLayoutsBySpaceId: {
        ...current.spaceLayoutsBySpaceId,
        [spaceId]: nextLayout
      },
      categoriesBySpaceId: {
        ...current.categoriesBySpaceId,
        [spaceId]: layoutToCategories(nextLayout)
      },
      rooms: applyLayoutToSpaceRooms(current.rooms, spaceId, nextLayout)
    }));
  },
  moveRoomToCategory: async (roomId, categoryId) => {
    const state = get();
    const spaceId = state.currentSpaceId;
    if (!spaceId) return;
    const spaceStateHostRoomId = resolveSpaceStateHostRoomId(state, spaceId);
    if (!spaceStateHostRoomId) return;
    const client = state.matrixClient;
    const spaceRooms = getSpaceRooms(state.rooms, spaceId);
    const baseLayout = hydrateLayoutForRooms(state.spaceLayoutsBySpaceId[spaceId] ?? null, spaceRooms);
    if (!baseLayout.rooms[roomId]) return;
    if (!baseLayout.categories.some((category) => category.id === categoryId)) return;

    const fromCategory = baseLayout.rooms[roomId].categoryId;
    if (fromCategory === categoryId) return;

    const nextLayout: SpaceLayout = {
      ...baseLayout,
      categories: [...baseLayout.categories],
      rooms: { ...baseLayout.rooms }
    };

    const sourceRoomIds = getOrderedRoomIdsByCategory(nextLayout, fromCategory).filter(
      (currentRoomId) => currentRoomId !== roomId
    );
    const targetRoomIds = getOrderedRoomIdsByCategory(nextLayout, categoryId);
    setRoomOrderForCategory(nextLayout, fromCategory, sourceRoomIds);
    setRoomOrderForCategory(nextLayout, categoryId, [...targetRoomIds, roomId]);

    if (client) {
      try {
        await client.sendStateEvent(spaceStateHostRoomId, SPACE_LAYOUT_EVENT as any, nextLayout, "");
      } catch (error) {
        get().pushNotification("Failed to move channel to category", (error as Error).message);
        return;
      }
    }

    set((current) => ({
      spaceLayoutsBySpaceId: {
        ...current.spaceLayoutsBySpaceId,
        [spaceId]: nextLayout
      },
      categoriesBySpaceId: {
        ...current.categoriesBySpaceId,
        [spaceId]: layoutToCategories(nextLayout)
      },
      rooms: applyLayoutToSpaceRooms(current.rooms, spaceId, nextLayout)
    }));
  },
  reorderRoom: async (sourceRoomId, targetRoomId, targetCategoryId) => {
    if (sourceRoomId === targetRoomId) return;
    const state = get();
    const spaceId = state.currentSpaceId;
    if (!spaceId) return;
    const spaceStateHostRoomId = resolveSpaceStateHostRoomId(state, spaceId);
    if (!spaceStateHostRoomId) return;
    const client = state.matrixClient;
    const spaceRooms = getSpaceRooms(state.rooms, spaceId);
    const baseLayout = hydrateLayoutForRooms(state.spaceLayoutsBySpaceId[spaceId] ?? null, spaceRooms);
    const sourcePlacement = baseLayout.rooms[sourceRoomId];
    const targetPlacement = baseLayout.rooms[targetRoomId];
    if (!sourcePlacement || !targetPlacement) return;

    const destinationCategoryId = targetCategoryId ?? targetPlacement.categoryId;
    if (!baseLayout.categories.some((category) => category.id === destinationCategoryId)) return;

    const nextLayout: SpaceLayout = {
      ...baseLayout,
      categories: [...baseLayout.categories],
      rooms: { ...baseLayout.rooms }
    };

    const sourceCategoryRoomIds = getOrderedRoomIdsByCategory(nextLayout, sourcePlacement.categoryId).filter(
      (roomId) => roomId !== sourceRoomId
    );
    setRoomOrderForCategory(nextLayout, sourcePlacement.categoryId, sourceCategoryRoomIds);

    const destinationRoomIds = getOrderedRoomIdsByCategory(nextLayout, destinationCategoryId);
    const targetIndex = destinationRoomIds.indexOf(targetRoomId);
    const insertIndex = targetIndex >= 0 ? targetIndex : destinationRoomIds.length;
    const withInsert = [
      ...destinationRoomIds.slice(0, insertIndex),
      sourceRoomId,
      ...destinationRoomIds.slice(insertIndex)
    ].filter((roomId, index, array) => array.indexOf(roomId) === index);
    setRoomOrderForCategory(nextLayout, destinationCategoryId, withInsert);

    if (client) {
      try {
        await client.sendStateEvent(spaceStateHostRoomId, SPACE_LAYOUT_EVENT as any, nextLayout, "");
      } catch (error) {
        get().pushNotification("Failed to reorder channels", (error as Error).message);
        return;
      }
    }

    set((current) => ({
      spaceLayoutsBySpaceId: {
        ...current.spaceLayoutsBySpaceId,
        [spaceId]: nextLayout
      },
      categoriesBySpaceId: {
        ...current.categoriesBySpaceId,
        [spaceId]: layoutToCategories(nextLayout)
      },
      rooms: applyLayoutToSpaceRooms(current.rooms, spaceId, nextLayout)
    }));
  },
  paginateCurrentRoomHistory: async () => {
    const client = get().matrixClient;
    const roomId = get().currentRoomId;
    if (!roomId) return;

    if (!client) {
      const loading = get().historyLoadingByRoomId[roomId];
      const hasMore = get().historyHasMoreByRoomId[roomId] ?? true;
      if (loading || !hasMore) return;

      set((state) => ({
        historyLoadingByRoomId: {
          ...state.historyLoadingByRoomId,
          [roomId]: true
        }
      }));

      await Promise.resolve();

      set((state) => {
        const existing = state.messagesByRoomId[roomId] ?? [];
        const oldestTimestamp = existing[0]?.timestamp ?? Date.now();
        const olderMessages: Message[] = Array.from({ length: 30 }, (_, index) => ({
          id: uid("m_hist"),
          roomId,
          authorId: state.users[index % state.users.length]?.id ?? state.me.id,
          body: `Older message ${index + 1} in #${roomId}`,
          timestamp: oldestTimestamp - (30 - index) * 60_000,
          reactions: []
        }));

        return {
          messagesByRoomId: {
            ...state.messagesByRoomId,
            [roomId]: [...olderMessages, ...existing]
          },
          historyHasMoreByRoomId: {
            ...state.historyHasMoreByRoomId,
            [roomId]: false
          },
          historyLoadingByRoomId: {
            ...state.historyLoadingByRoomId,
            [roomId]: false
          }
        };
      });
      return;
    }

    const loading = get().historyLoadingByRoomId[roomId];
    const hasMore = get().historyHasMoreByRoomId[roomId] ?? true;
    if (loading || !hasMore) return;

    const room = client.getRoom(roomId);
    if (!room) return;

    set((state) => ({
      historyLoadingByRoomId: {
        ...state.historyLoadingByRoomId,
        [roomId]: true
      }
    }));

    try {
      const hasMoreHistory = await client.paginateEventTimeline(room.getLiveTimeline(), {
        backwards: true,
        limit: 40
      });
      const messages = mapEventsToMessages(client, room);

      set((state) => ({
        messagesByRoomId: {
          ...state.messagesByRoomId,
          [roomId]: messages
        },
        historyHasMoreByRoomId: {
          ...state.historyHasMoreByRoomId,
          [roomId]: hasMoreHistory
        },
        historyLoadingByRoomId: {
          ...state.historyLoadingByRoomId,
          [roomId]: false
        }
      }));
    } catch (error) {
      console.warn("Failed to paginate room history", error);
      set((state) => ({
        historyLoadingByRoomId: {
          ...state.historyLoadingByRoomId,
          [roomId]: false
        }
      }));
    }
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
  redactMessage: async (messageId) => {
    const client = get().matrixClient;
    const spaceId = get().currentSpaceId;
    const roomId = get().currentRoomId;
    const currentMessages = get().messagesByRoomId[roomId] ?? [];
    const targetMessage = currentMessages.find((message) => message.id === messageId);
    const createAuditEntry = (
      targetEventId: string,
      sourceEventId: string = targetEventId
    ): ModerationAuditEvent => ({
      id: uid("audit"),
      action: "message.redact",
      actorId: get().me.id,
      target: targetMessage ? `${targetMessage.authorId}:${targetEventId}` : targetEventId,
      timestamp: Date.now(),
      sourceEventId
    });

    if (!client) {
      const auditEntry = createAuditEntry(messageId);
      set((state) => ({
        messagesByRoomId: {
          ...state.messagesByRoomId,
          [roomId]: (state.messagesByRoomId[roomId] ?? []).filter((message) => message.id !== messageId)
        },
        moderationAuditBySpaceId: {
          ...state.moderationAuditBySpaceId,
          [spaceId]: [auditEntry, ...(state.moderationAuditBySpaceId[spaceId] ?? [])].slice(0, 250)
        }
      }));
      trackLocalMetricEvent("moderation_action_success", {
        mode: "local",
        action: "redact",
        roomId
      });
      return;
    }

    const room = client.getRoom(roomId);
    if (!room) return;

    const commitMatrixDelete = async (targetEventId: string, sourceEventId: string = targetEventId) => {
      const timelineMessages = mapEventsToMessages(client, room);
      const auditEntry = createAuditEntry(targetEventId, sourceEventId);
      const nextAudit = [auditEntry, ...(get().moderationAuditBySpaceId[spaceId] ?? [])].slice(0, 250);
      await client
        .sendStateEvent(spaceId, AUDIT_LOG_EVENT as any, { version: 1, events: nextAudit }, "")
        .catch(() => undefined);

      set((state) => ({
        messagesByRoomId: {
          ...state.messagesByRoomId,
          [room.roomId]: resolveTimelineMessages({
            existingMessages: state.messagesByRoomId[room.roomId] ?? [],
            timelineMessages,
            removeMessageIds: [targetEventId, sourceEventId]
          })
        },
        moderationAuditBySpaceId: {
          ...state.moderationAuditBySpaceId,
          [spaceId]: nextAudit
        }
      }));
      trackLocalMetricEvent("moderation_action_success", {
        mode: "matrix",
        action: "redact",
        roomId: room.roomId
      });
    };

    const redactServerEvent = async (targetEventId: string, sourceEventId: string = targetEventId) => {
      await client.redactEvent(room.roomId, targetEventId);
      await commitMatrixDelete(targetEventId, sourceEventId);
    };

    if (messageId.startsWith("~")) {
      const localEvent = typeof room.findEventById === "function" ? room.findEventById(messageId) : undefined;
      const localStatus = localEvent?.status ?? null;
      const transactionId = getLocalEchoTransactionId(room.roomId, messageId);

      if (
        localEvent &&
        (localStatus === EventStatus.QUEUED ||
          localStatus === EventStatus.NOT_SENT ||
          localStatus === EventStatus.ENCRYPTING)
      ) {
        try {
          client.cancelPendingEvent(localEvent);
          await commitMatrixDelete(messageId);
          if (transactionId) {
            removePendingRedactionIntent(room.roomId, transactionId);
          }
          return;
        } catch (error) {
          console.warn("Failed to cancel pending event before delete, retrying via remote echo path", error);
        }
      }

      if (transactionId) {
        const remoteEchoEventId = findRemoteEchoEventId(room, transactionId);
        if (remoteEchoEventId && !remoteEchoEventId.startsWith("~")) {
          try {
            await redactServerEvent(remoteEchoEventId, messageId);
            removePendingRedactionIntent(room.roomId, transactionId);
          } catch (error) {
            queuePendingRedactionIntent({
              roomId: room.roomId,
              transactionId,
              sourceMessageId: messageId,
              queuedAt: Date.now()
            });
            get().pushNotification("Unable to delete message", (error as Error).message);
          }
          return;
        }
      }

      if (localEvent) {
        if (transactionId) {
          queuePendingRedactionIntent({
            roomId: room.roomId,
            transactionId,
            sourceMessageId: messageId,
            queuedAt: Date.now()
          });
        }
        localEvent.once(MatrixEventEvent.LocalEventIdReplaced, (event) => {
          const remoteEventId = event.getId();
          if (!remoteEventId || remoteEventId.startsWith("~")) return;
          void redactServerEvent(remoteEventId, messageId).catch((error) => {
            get().pushNotification("Unable to delete message", (error as Error).message);
          }).finally(() => {
            if (transactionId) {
              removePendingRedactionIntent(room.roomId, transactionId);
            }
          });
        });
        get().pushNotification("Delete queued", "Message is still sending and will be deleted after sync.");
        return;
      }

      if (transactionId) {
        queuePendingRedactionIntent({
          roomId: room.roomId,
          transactionId,
          sourceMessageId: messageId,
          queuedAt: Date.now()
        });
        get().pushNotification(
          "Delete queued",
          "Message is still syncing and will be deleted after the server echo arrives."
        );
        return;
      }
      get().pushNotification("Unable to delete message", "Message is still syncing. Try again in a moment.");
      return;
    }

    try {
      await redactServerEvent(messageId);
    } catch (error) {
      get().pushNotification("Unable to delete message", (error as Error).message);
    }
  },
  copyMessageLink: async (messageId) => {
    const client = get().matrixClient;
    const roomId = get().currentRoomId;
    if (!roomId) return;
    const room = client?.getRoom(roomId);
    const target = room?.getCanonicalAlias() || roomId;
    const link = `https://matrix.to/#/${encodeURIComponent(target)}/${encodeURIComponent(messageId)}`;

    if (!navigator.clipboard?.writeText) {
      get().pushNotification("Message link", link);
      return;
    }

    try {
      await navigator.clipboard.writeText(link);
      get().pushNotification("Message link copied", link);
    } catch {
      get().pushNotification("Message link", link);
    }
  },
  startReply: (messageId) => set({ replyToId: messageId }),
  clearReply: () => set({ replyToId: null }),
  simulateIncoming: () =>
    set((state) => {
      const body = `@${state.me.name} check the latest onboarding tweaks in #welcome.`;
      const timestamp = Date.now();
      const message: Message = {
        id: uid("m"),
        roomId: state.currentRoomId,
        authorId: state.users[0]?.id ?? state.me.id,
        body,
        timestamp,
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
  completeOnboarding: () => {
    savePreferences({
      ...toPreferencesFromState(get()),
      onboardingCompleted: true
    });
    trackLocalMetricEvent("settings_completion", { setting: "onboardingCompleted", value: true });
    set({ onboardingStep: null });
  },
  joinCall: async () => {
    if (!areAdvancedCallsEnabled()) {
      get().pushNotification("Calls disabled", "Enable VITE_ENABLE_ADVANCED_CALLS to use call controls.");
      return;
    }

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
    if (!areAdvancedCallsEnabled()) return;
    const client = get().matrixClient;
    const callState = get().callState;
    if (!client || !callState.roomId) return;
    const call = client.getGroupCallForRoom(callState.roomId);
    if (!call) return;
    call.setMicrophoneMuted(!callState.micMuted).catch(() => undefined);
  },
  toggleVideo: () => {
    if (!areAdvancedCallsEnabled()) return;
    const client = get().matrixClient;
    const callState = get().callState;
    if (!client || !callState.roomId) return;
    const call = client.getGroupCallForRoom(callState.roomId);
    if (!call) return;
    call.setLocalVideoMuted(!callState.videoMuted).catch(() => undefined);
  },
  toggleScreenShare: () => {
    if (!areAdvancedCallsEnabled()) return;
    const client = get().matrixClient;
    const callState = get().callState;
    if (!client || !callState.roomId) return;
    const call = client.getGroupCallForRoom(callState.roomId);
    if (!call) return;
    const next = !(callState.screenSharing ?? false);
    call.setScreensharingEnabled(next).catch(() => undefined);
  }
});
