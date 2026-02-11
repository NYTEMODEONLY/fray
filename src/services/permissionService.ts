import {
  PERMISSION_ACTIONS,
  PermissionAction,
  PermissionRule,
  PermissionRuleSet,
  ServerSettings
} from "../types";

export type PermissionRole = "owner" | "moderator" | "member" | "guest";

export type MatrixMembership = "join" | "invite" | "leave" | "ban" | "knock" | "unknown";

export interface MatrixPowerLevels {
  users: Record<string, number>;
  usersDefault: number;
  events: Record<string, number>;
  eventsDefault: number;
  stateDefault: number;
  invite: number;
  redact: number;
}

export interface PermissionSnapshot {
  role: PermissionRole;
  membership: MatrixMembership;
  powerLevel: number;
  actions: Record<PermissionAction, boolean>;
}

interface BuildPermissionSnapshotInput {
  userId: string;
  membership: MatrixMembership;
  powerLevels: MatrixPowerLevels;
  roleSettings: ServerSettings["roles"];
  categoryRules?: PermissionRuleSet;
  roomRules?: PermissionRuleSet;
}

const defaultPowerLevels: MatrixPowerLevels = {
  users: {},
  usersDefault: 0,
  events: {},
  eventsDefault: 0,
  stateDefault: 50,
  invite: 0,
  redact: 50
};

const normalizeNumberRecord = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== "object") return {};
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, number>>(
    (accumulator, [key, raw]) => {
      if (typeof raw === "number" && Number.isFinite(raw)) {
        accumulator[key] = raw;
      }
      return accumulator;
    },
    {}
  );
};

const toValidNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

export const parsePowerLevels = (content: unknown): MatrixPowerLevels => {
  if (!content || typeof content !== "object") {
    return defaultPowerLevels;
  }
  const parsed = content as Record<string, unknown>;
  return {
    users: normalizeNumberRecord(parsed.users),
    usersDefault: toValidNumber(parsed.users_default, defaultPowerLevels.usersDefault),
    events: normalizeNumberRecord(parsed.events),
    eventsDefault: toValidNumber(parsed.events_default, defaultPowerLevels.eventsDefault),
    stateDefault: toValidNumber(parsed.state_default, defaultPowerLevels.stateDefault),
    invite: toValidNumber(parsed.invite, defaultPowerLevels.invite),
    redact: toValidNumber(parsed.redact, defaultPowerLevels.redact)
  };
};

export const getUserPowerLevel = (powerLevels: MatrixPowerLevels, userId: string) =>
  powerLevels.users[userId] ?? powerLevels.usersDefault;

const getRequiredLevelForAction = (action: PermissionAction, powerLevels: MatrixPowerLevels) => {
  if (action === "send") {
    return powerLevels.events["m.room.message"] ?? powerLevels.eventsDefault;
  }
  if (action === "react") {
    return powerLevels.events["m.reaction"] ?? powerLevels.eventsDefault;
  }
  if (action === "pin") {
    return powerLevels.events["m.room.pinned_events"] ?? powerLevels.stateDefault;
  }
  if (action === "redact") {
    return powerLevels.redact;
  }
  if (action === "invite") {
    return powerLevels.invite;
  }
  return powerLevels.stateDefault;
};

const deriveRole = (
  membership: MatrixMembership,
  powerLevel: number,
  roleSettings: ServerSettings["roles"]
): PermissionRole => {
  if (membership !== "join") return "guest";
  if (powerLevel >= roleSettings.adminLevel) return "owner";
  if (powerLevel >= roleSettings.moderatorLevel) return "moderator";
  return "member";
};

const resolveRule = (
  action: PermissionAction,
  categoryRules?: PermissionRuleSet,
  roomRules?: PermissionRuleSet
): PermissionRule => {
  const roomRule = roomRules?.[action];
  if (roomRule === "allow" || roomRule === "deny") return roomRule;
  const categoryRule = categoryRules?.[action];
  if (categoryRule === "allow" || categoryRule === "deny") return categoryRule;
  return "inherit";
};

const applyRule = (base: boolean, rule: PermissionRule) => {
  if (rule === "deny") return false;
  if (rule === "allow") return true;
  return base;
};

const getRoleAssignedPowerLevel = (
  userId: string,
  roleSettings: ServerSettings["roles"]
) => {
  const definitions = roleSettings.definitions ?? [];
  const roleIds = roleSettings.memberRoleIds?.[userId] ?? [];
  const rolePowerById = new Map(definitions.map((role) => [role.id, role.powerLevel]));
  const assignedPower = roleIds.reduce<number>((maxPower, roleId) => {
    const rolePower = rolePowerById.get(roleId);
    if (typeof rolePower !== "number" || !Number.isFinite(rolePower)) {
      return maxPower;
    }
    return Math.max(maxPower, rolePower);
  }, Number.NEGATIVE_INFINITY);
  const defaultLevel = Number.isFinite(roleSettings.defaultLevel) ? roleSettings.defaultLevel : 0;
  if (!Number.isFinite(assignedPower)) {
    return defaultLevel;
  }
  return Math.max(defaultLevel, assignedPower);
};

const hasRolePermissionGrant = (
  userId: string,
  roleSettings: ServerSettings["roles"],
  action: PermissionAction
) => {
  const assignedRoleIds = new Set(roleSettings.memberRoleIds?.[userId] ?? []);
  if (!assignedRoleIds.size) return false;
  return (roleSettings.definitions ?? []).some((role) => {
    if (!assignedRoleIds.has(role.id)) return false;
    return role.permissions?.[action] === true;
  });
};

export const buildPermissionSnapshot = ({
  userId,
  membership,
  powerLevels,
  roleSettings,
  categoryRules,
  roomRules
}: BuildPermissionSnapshotInput): PermissionSnapshot => {
  const matrixPowerLevel = getUserPowerLevel(powerLevels, userId);
  const roleAssignedPowerLevel = getRoleAssignedPowerLevel(userId, roleSettings);
  const powerLevel = Math.max(matrixPowerLevel, roleAssignedPowerLevel);
  const role = deriveRole(membership, powerLevel, roleSettings);

  const actions = PERMISSION_ACTIONS.reduce<Record<PermissionAction, boolean>>((accumulator, action) => {
    const matrixBase =
      membership === "join" && powerLevel >= getRequiredLevelForAction(action, powerLevels);
    const roleGrant = membership === "join" && hasRolePermissionGrant(userId, roleSettings, action);
    const base = matrixBase || roleGrant;
    const rule = resolveRule(action, categoryRules, roomRules);
    accumulator[action] = applyRule(base, rule);
    return accumulator;
  }, {} as Record<PermissionAction, boolean>);

  return {
    role,
    membership,
    powerLevel,
    actions
  };
};

export const canRedactMessage = (
  snapshot: PermissionSnapshot,
  messageAuthorId: string,
  currentUserId: string
) => {
  if (snapshot.membership !== "join") return false;
  if (snapshot.actions.redact && (snapshot.role === "owner" || snapshot.role === "moderator")) {
    return true;
  }
  return messageAuthorId === currentUserId;
};
