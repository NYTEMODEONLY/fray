import type { AppState, AppStateGet, AppStateSet, ModerationAuditEvent, SpacePermissionOverrides } from "../shared";
import {
  AUDIT_LOG_EVENT,
  PERMISSION_OVERRIDES_EVENT,
  SERVER_SETTINGS_EVENT,
  defaultModerationAuditBySpace,
  defaultPermissionOverridesBySpace,
  defaultServerSettingsBySpace,
  normalizePermissionOverrides,
  normalizeServerSettings,
  resolveSpaceStateHostRoomId,
  uid,
  withAppliedServerRoles
} from "../shared";

export type AdminSliceState = Pick<
  AppState,
  | "serverSettingsBySpaceId"
  | "permissionOverridesBySpaceId"
  | "moderationAuditBySpaceId"
  | "saveServerSettings"
  | "setCategoryPermissionRule"
  | "setRoomPermissionRule"
>;

export const createAdminSliceState = (
  set: AppStateSet,
  get: AppStateGet
): AdminSliceState => ({
  serverSettingsBySpaceId: defaultServerSettingsBySpace,
  permissionOverridesBySpaceId: defaultPermissionOverridesBySpace,
  moderationAuditBySpaceId: defaultModerationAuditBySpace,
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
  }
});
