import { useEffect, useMemo, useState } from "react";
import {
  Category,
  ModerationAuditEvent,
  PERMISSION_ACTIONS,
  PermissionAction,
  PermissionRule,
  PermissionRuleSet,
  Room,
  ServerRoleDefinition,
  ServerSettings,
  Space,
  SpacePermissionOverrides,
  User
} from "../types";
import { ServerSettingsTab } from "../store/appStore";

interface ServerSettingsModalProps {
  space: Space;
  rooms: Room[];
  categories: Category[];
  settings?: ServerSettings;
  permissionOverrides?: SpacePermissionOverrides;
  moderationAudit: ModerationAuditEvent[];
  canManageChannels: boolean;
  canDeleteChannels: boolean;
  users: User[];
  activeTab: ServerSettingsTab;
  onTabChange: (tab: ServerSettingsTab) => void;
  onClose: () => void;
  onRenameSpace: (name: string) => Promise<void>;
  onSaveSettings: (settings: ServerSettings) => Promise<void>;
  onSetCategoryPermissionRule: (categoryId: string, action: PermissionAction, rule: PermissionRule) => Promise<void>;
  onSetRoomPermissionRule: (roomId: string, action: PermissionAction, rule: PermissionRule) => Promise<void>;
  onCreateCategory: (name: string) => Promise<void>;
  onRenameCategory: (categoryId: string, name: string) => Promise<void>;
  onDeleteCategory: (categoryId: string) => Promise<void>;
  onMoveCategoryByStep: (categoryId: string, direction: "up" | "down") => Promise<void>;
  onReorderCategory: (sourceCategoryId: string, targetCategoryId: string) => Promise<void>;
  onMoveRoomByStep: (roomId: string, direction: "up" | "down") => Promise<void>;
  onMoveRoomToCategory: (roomId: string, categoryId: string) => Promise<void>;
  onReorderRoom: (sourceRoomId: string, targetRoomId: string, targetCategoryId?: string) => Promise<void>;
}

const tabs: Array<{ id: ServerSettingsTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "roles", label: "Roles" },
  { id: "members", label: "Members" },
  { id: "channels", label: "Channels" },
  { id: "invites", label: "Invites" },
  { id: "moderation", label: "Moderation" }
];

const defaultSettings: ServerSettings = {
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
};

const roomTypeIcon = (room: Room) =>
  room.type === "text" ? "#" : room.type === "voice" ? "🔊" : room.type === "video" ? "📹" : "✉";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const parseInteger = (value: string, fallback: number, min: number, max: number) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return clamp(parsed, min, max);
};

const createRoleId = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || `role-${Math.random().toString(36).slice(2, 8)}`;

const rolePermissionDefinitions: Array<{
  action: PermissionAction;
  label: string;
  description: string;
}> = [
  {
    action: "manageChannels",
    label: "Manage Channels",
    description: "Create, reorder, move, and delete channels and categories."
  },
  {
    action: "invite",
    label: "Create Invites",
    description: "Generate and share server invite links."
  },
  {
    action: "send",
    label: "Send Messages",
    description: "Post messages in text channels."
  },
  {
    action: "react",
    label: "Add Reactions",
    description: "React to messages with emojis."
  },
  {
    action: "pin",
    label: "Pin Messages",
    description: "Pin and unpin important messages."
  },
  {
    action: "redact",
    label: "Delete Messages",
    description: "Redact messages when moderation is required."
  }
];

export const ServerSettingsModal = ({
  space,
  rooms,
  categories,
  settings,
  permissionOverrides,
  moderationAudit,
  canManageChannels,
  canDeleteChannels,
  users,
  activeTab,
  onTabChange,
  onClose,
  onRenameSpace,
  onSaveSettings,
  onSetCategoryPermissionRule,
  onSetRoomPermissionRule,
  onCreateCategory,
  onRenameCategory,
  onDeleteCategory,
  onMoveCategoryByStep,
  onReorderCategory,
  onMoveRoomByStep,
  onMoveRoomToCategory,
  onReorderRoom
}: ServerSettingsModalProps) => {
  const activeSettings = settings ?? defaultSettings;
  const activePermissionOverrides = permissionOverrides ?? {
    version: 1,
    categories: {},
    rooms: {}
  };

  const [spaceName, setSpaceName] = useState(space.name);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [overviewDescription, setOverviewDescription] = useState(activeSettings.overview.description);
  const [overviewGuidelines, setOverviewGuidelines] = useState(activeSettings.overview.guidelines);
  const [adminLevel, setAdminLevel] = useState(String(activeSettings.roles.adminLevel));
  const [moderatorLevel, setModeratorLevel] = useState(String(activeSettings.roles.moderatorLevel));
  const [defaultLevel, setDefaultLevel] = useState(String(activeSettings.roles.defaultLevel));
  const [linkExpiryHours, setLinkExpiryHours] = useState(String(activeSettings.invites.linkExpiryHours));
  const [requireInviteApproval, setRequireInviteApproval] = useState(
    activeSettings.invites.requireApproval
  );
  const [allowGuestInvites, setAllowGuestInvites] = useState(activeSettings.invites.allowGuestInvites);
  const [safetyLevel, setSafetyLevel] = useState(activeSettings.moderation.safetyLevel);
  const [blockUnknownMedia, setBlockUnknownMedia] = useState(activeSettings.moderation.blockUnknownMedia);
  const [auditLogRetentionDays, setAuditLogRetentionDays] = useState(
    String(activeSettings.moderation.auditLogRetentionDays)
  );
  const [customRoles, setCustomRoles] = useState<ServerRoleDefinition[]>(
    activeSettings.roles.definitions ?? []
  );
  const [memberRoleIds, setMemberRoleIds] = useState<Record<string, string[]>>(
    activeSettings.roles.memberRoleIds ?? {}
  );
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("#7d8cff");
  const [newRolePowerLevel, setNewRolePowerLevel] = useState(
    String(activeSettings.roles.moderatorLevel)
  );
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [selectedPermissionCategory, setSelectedPermissionCategory] = useState(
    categories[0]?.id ?? "channels"
  );
  const [selectedPermissionRoom, setSelectedPermissionRoom] = useState(
    rooms.find((room) => room.type !== "dm")?.id ?? ""
  );

  useEffect(() => {
    const next = settings ?? defaultSettings;
    setSpaceName(space.name);
    setOverviewDescription(next.overview.description);
    setOverviewGuidelines(next.overview.guidelines);
    setAdminLevel(String(next.roles.adminLevel));
    setModeratorLevel(String(next.roles.moderatorLevel));
    setDefaultLevel(String(next.roles.defaultLevel));
    setLinkExpiryHours(String(next.invites.linkExpiryHours));
    setRequireInviteApproval(next.invites.requireApproval);
    setAllowGuestInvites(next.invites.allowGuestInvites);
    setSafetyLevel(next.moderation.safetyLevel);
    setBlockUnknownMedia(next.moderation.blockUnknownMedia);
    setAuditLogRetentionDays(String(next.moderation.auditLogRetentionDays));
    setCustomRoles(next.roles.definitions ?? []);
    setMemberRoleIds(next.roles.memberRoleIds ?? {});
    setNewRoleName("");
    setNewRoleColor("#7d8cff");
    setNewRolePowerLevel(String(next.roles.moderatorLevel));
    setSelectedRoleId(next.roles.definitions?.[0]?.id ?? "");
    setCopiedInvite(false);
  }, [settings, space.id, space.name]);

  useEffect(() => {
    if (!categories.length) return;
    if (categories.some((category) => category.id === selectedPermissionCategory)) return;
    setSelectedPermissionCategory(categories[0].id);
  }, [categories, selectedPermissionCategory]);

  useEffect(() => {
    const roomOptions = rooms.filter((room) => room.type !== "dm");
    if (!roomOptions.length) return;
    if (roomOptions.some((room) => room.id === selectedPermissionRoom)) return;
    setSelectedPermissionRoom(roomOptions[0].id);
  }, [rooms, selectedPermissionRoom]);

  useEffect(() => {
    if (!customRoles.length) {
      if (selectedRoleId) {
        setSelectedRoleId("");
      }
      return;
    }
    if (customRoles.some((role) => role.id === selectedRoleId)) return;
    setSelectedRoleId(customRoles[0]?.id ?? "");
  }, [customRoles, selectedRoleId]);

  const channelCategories = useMemo(() => {
    const categoryMap = new Map(
      categories.map((category) => [
        category.id,
        { ...category, rooms: [] as Room[] }
      ])
    );

    rooms
      .filter((room) => room.type !== "dm")
      .forEach((room) => {
        const categoryId = room.category ?? "channels";
        const target =
          categoryMap.get(categoryId) ??
          {
            id: categoryId,
            name: categoryId,
            order: categoryMap.size,
            rooms: [] as Room[]
          };
        target.rooms.push(room);
        categoryMap.set(categoryId, target);
      });

    return Array.from(categoryMap.values())
      .map((category) => ({
        ...category,
        rooms: [...category.rooms].sort(
          (left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0)
        )
      }))
      .sort((left, right) => left.order - right.order);
  }, [categories, rooms]);

  const inviteLink = `https://matrix.to/#/${encodeURIComponent(space.id)}`;
  const permissionRooms = useMemo(() => rooms.filter((room) => room.type !== "dm"), [rooms]);
  const selectedCategoryRules =
    activePermissionOverrides.categories[selectedPermissionCategory] ?? {};
  const selectedRoomRules = activePermissionOverrides.rooms[selectedPermissionRoom] ?? {};

  const ruleFor = (source: PermissionRuleSet | undefined, action: PermissionAction): PermissionRule => {
    const rule = source?.[action];
    return rule === "allow" || rule === "deny" ? rule : "inherit";
  };

  const nextSettings: ServerSettings = {
    version: 1,
    overview: {
      description: overviewDescription.trim(),
      guidelines: overviewGuidelines.trim()
    },
    roles: {
      adminLevel: parseInteger(adminLevel, activeSettings.roles.adminLevel, 0, 100),
      moderatorLevel: parseInteger(moderatorLevel, activeSettings.roles.moderatorLevel, 0, 100),
      defaultLevel: parseInteger(defaultLevel, activeSettings.roles.defaultLevel, 0, 100),
      definitions: customRoles,
      memberRoleIds
    },
    invites: {
      linkExpiryHours: parseInteger(linkExpiryHours, activeSettings.invites.linkExpiryHours, 1, 168),
      requireApproval: requireInviteApproval,
      allowGuestInvites
    },
    moderation: {
      safetyLevel,
      blockUnknownMedia,
      auditLogRetentionDays: parseInteger(
        auditLogRetentionDays,
        activeSettings.moderation.auditLogRetentionDays,
        7,
        365
      )
    }
  };

  const roleMemberCountById = useMemo(
    () =>
      customRoles.reduce<Record<string, number>>((accumulator, role) => {
        accumulator[role.id] = Object.values(memberRoleIds).filter((roleIds) => roleIds.includes(role.id)).length;
        return accumulator;
      }, {}),
    [customRoles, memberRoleIds]
  );

  const createRole = () => {
    const trimmed = newRoleName.trim();
    if (!trimmed) return;
    const baseRoleId = createRoleId(trimmed);
    let roleId = baseRoleId;
    let suffix = 2;
    while (customRoles.some((role) => role.id === roleId)) {
      roleId = `${baseRoleId}-${suffix}`;
      suffix += 1;
    }
    const powerLevel = parseInteger(
      newRolePowerLevel,
      activeSettings.roles.defaultLevel,
      0,
      100
    );
    setCustomRoles((current) => [
      ...current,
      {
        id: roleId,
        name: trimmed,
        color: /^#[0-9a-fA-F]{6}$/.test(newRoleColor) ? newRoleColor : "#8b93a7",
        powerLevel,
        permissions: {}
      }
    ]);
    setSelectedRoleId(roleId);
    setNewRoleName("");
  };

  const renameRole = (roleId: string) => {
    const existing = customRoles.find((role) => role.id === roleId);
    if (!existing) return;
    const nextName = window.prompt("Rename role", existing.name);
    if (!nextName?.trim()) return;
    setCustomRoles((current) =>
      current.map((role) => (role.id === roleId ? { ...role, name: nextName.trim() } : role))
    );
  };

  const deleteRole = (roleId: string) => {
    const remainingRoles = customRoles.filter((role) => role.id !== roleId);
    setCustomRoles(remainingRoles);
    if (selectedRoleId === roleId) {
      setSelectedRoleId(remainingRoles[0]?.id ?? "");
    }
    setMemberRoleIds((current) => {
      const next = Object.entries(current).reduce<Record<string, string[]>>((accumulator, [userId, roleIds]) => {
        const remaining = roleIds.filter((id) => id !== roleId);
        if (remaining.length) {
          accumulator[userId] = remaining;
        }
        return accumulator;
      }, {});
      return next;
    });
  };

  const toggleRoleAssignment = (userId: string, roleId: string) => {
    setMemberRoleIds((current) => {
      const existing = current[userId] ?? [];
      const hasRole = existing.includes(roleId);
      const nextRoleIds = hasRole ? existing.filter((id) => id !== roleId) : [...existing, roleId];
      const next = { ...current };
      if (nextRoleIds.length) {
        next[userId] = nextRoleIds;
      } else {
        delete next[userId];
      }
      return next;
    });
  };

  const setRolePermissionEnabled = (
    roleId: string,
    action: PermissionAction,
    enabled: boolean
  ) => {
    setCustomRoles((current) =>
      current.map((role) => {
        if (role.id !== roleId) return role;
        const nextPermissions = { ...(role.permissions ?? {}) };
        if (enabled) {
          nextPermissions[action] = true;
        } else {
          delete nextPermissions[action];
        }
        return {
          ...role,
          permissions: nextPermissions
        };
      })
    );
  };

  const selectedRole = customRoles.find((role) => role.id === selectedRoleId) ?? null;

  return (
    <div className="settings-backdrop" role="dialog" aria-modal="true" aria-label="Server settings">
      <section className="settings-modal">
        <aside className="settings-nav">
          <div className="settings-space-meta">
            <p className="eyebrow">Server Settings</p>
            <h2>{space.name}</h2>
          </div>
          <div className="settings-tab-list">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={activeTab === tab.id ? "settings-tab active" : "settings-tab"}
                onClick={() => onTabChange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button className="pill ghost" onClick={onClose}>
            Close
          </button>
        </aside>

        <div className="settings-content">
          {activeTab === "overview" && (
            <section className="settings-panel">
              <h3>Server Overview</h3>
              <p>Update identity and intro details shown across the community.</p>
              <label className="settings-field">
                Server Name
                <input value={spaceName} onChange={(event) => setSpaceName(event.target.value)} />
              </label>
              <label className="settings-field">
                Description
                <textarea
                  value={overviewDescription}
                  onChange={(event) => setOverviewDescription(event.target.value)}
                  rows={3}
                  placeholder="What this server is about"
                />
              </label>
              <label className="settings-field">
                Guidelines
                <textarea
                  value={overviewGuidelines}
                  onChange={(event) => setOverviewGuidelines(event.target.value)}
                  rows={4}
                  placeholder="Short policy summary for new members"
                />
              </label>
              <div className="settings-row">
                <button
                  className="primary"
                  onClick={() => onRenameSpace(spaceName)}
                  disabled={!spaceName.trim() || spaceName.trim() === space.name}
                >
                  Save Name
                </button>
                <button className="primary" onClick={() => onSaveSettings(nextSettings)}>
                  Save Overview
                </button>
              </div>
            </section>
          )}

          {activeTab === "roles" && (
            <section className="settings-panel">
              <h3>Roles</h3>
              <p>Manage role tiers, custom roles, and assignment defaults for this server.</p>
              <div className="settings-grid">
                <label className="settings-field">
                  Admin Power Level
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={adminLevel}
                    onChange={(event) => setAdminLevel(event.target.value)}
                  />
                </label>
                <label className="settings-field">
                  Moderator Power Level
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={moderatorLevel}
                    onChange={(event) => setModeratorLevel(event.target.value)}
                  />
                </label>
                <label className="settings-field">
                  Member Default Power Level
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={defaultLevel}
                    onChange={(event) => setDefaultLevel(event.target.value)}
                  />
                </label>
              </div>

              <div className="settings-create-row">
                <input
                  placeholder="new-role"
                  value={newRoleName}
                  onChange={(event) => setNewRoleName(event.target.value)}
                  disabled={!canManageChannels}
                />
                <input
                  type="color"
                  value={newRoleColor}
                  onChange={(event) => setNewRoleColor(event.target.value)}
                  aria-label="Role color"
                  disabled={!canManageChannels}
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={newRolePowerLevel}
                  onChange={(event) => setNewRolePowerLevel(event.target.value)}
                  aria-label="Role power level"
                  disabled={!canManageChannels}
                />
                <button className="primary" onClick={createRole} disabled={!canManageChannels}>
                  Create Role
                </button>
              </div>

              <div className="settings-roles-layout">
                <section className="settings-role-list-panel">
                  <h4>Role List</h4>
                  <div className="settings-role-list">
                    {customRoles.length === 0 ? (
                      <p>No custom roles yet. Create one to assign server-specific capabilities.</p>
                    ) : (
                      customRoles.map((role) => (
                        <button
                          key={role.id}
                          className={selectedRoleId === role.id ? "settings-role-list-item active" : "settings-role-list-item"}
                          onClick={() => setSelectedRoleId(role.id)}
                        >
                          <span
                            aria-hidden="true"
                            className="settings-role-color-dot"
                            style={{ background: role.color }}
                          />
                          <span className="settings-role-list-name">{role.name}</span>
                          <small>{roleMemberCountById[role.id] ?? 0}</small>
                        </button>
                      ))
                    )}
                  </div>
                </section>

                <section className="settings-role-detail-panel">
                  {!selectedRole ? (
                    <p>Select a role to edit display, permissions, and members.</p>
                  ) : (
                    <>
                      <div className="settings-role-row">
                        <div className="settings-role-meta">
                          <p className="settings-role-name-row">
                            <span
                              aria-hidden="true"
                              className="settings-role-color-dot"
                              style={{ background: selectedRole.color }}
                            />
                            {selectedRole.name}
                          </p>
                          <small>
                            PL {selectedRole.powerLevel} · {roleMemberCountById[selectedRole.id] ?? 0} member
                            {roleMemberCountById[selectedRole.id] === 1 ? "" : "s"}
                          </small>
                        </div>
                        <div className="settings-role-controls">
                          <label className="settings-role-color-field">
                            Color
                            <input
                              type="color"
                              aria-label={`${selectedRole.name} color`}
                              value={selectedRole.color}
                              disabled={!canManageChannels}
                              onChange={(event) =>
                                setCustomRoles((current) =>
                                  current.map((item) =>
                                    item.id === selectedRole.id ? { ...item, color: event.target.value } : item
                                  )
                                )
                              }
                            />
                          </label>
                          <label className="settings-role-power-field">
                            PL
                            <input
                              type="number"
                              min={0}
                              max={100}
                              aria-label={`${selectedRole.name} power level`}
                              value={String(selectedRole.powerLevel)}
                              disabled={!canManageChannels}
                              onChange={(event) =>
                                setCustomRoles((current) =>
                                  current.map((item) =>
                                    item.id === selectedRole.id
                                      ? {
                                          ...item,
                                          powerLevel: parseInteger(event.target.value, item.powerLevel, 0, 100)
                                        }
                                      : item
                                  )
                                )
                              }
                            />
                          </label>
                          <button disabled={!canManageChannels} onClick={() => renameRole(selectedRole.id)}>
                            Rename
                          </button>
                          <button disabled={!canManageChannels} onClick={() => deleteRole(selectedRole.id)}>
                            Delete
                          </button>
                        </div>
                      </div>

                      <section className="settings-subsection">
                        <h4>Permissions</h4>
                        <p>Toggle server-wide capabilities for this role. Channel rules can still override them.</p>
                        <div className="settings-role-permission-list">
                          {rolePermissionDefinitions.map((permissionItem) => {
                            const enabled = selectedRole.permissions?.[permissionItem.action] === true;
                            return (
                              <label key={`${selectedRole.id}-${permissionItem.action}`} className="settings-role-permission-row">
                                <div>
                                  <strong>{permissionItem.label}</strong>
                                  <p>{permissionItem.description}</p>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={enabled}
                                  disabled={!canManageChannels}
                                  aria-label={permissionItem.label}
                                  onChange={(event) =>
                                    setRolePermissionEnabled(
                                      selectedRole.id,
                                      permissionItem.action,
                                      event.target.checked
                                    )
                                  }
                                />
                              </label>
                            );
                          })}
                        </div>
                      </section>

                      <section className="settings-subsection">
                        <h4>Manage Members</h4>
                        <p>Assign this role directly from here, or use the Members tab for bulk editing.</p>
                        <div className="settings-member-list">
                          {users.map((user) => {
                            const checked = (memberRoleIds[user.id] ?? []).includes(selectedRole.id);
                            return (
                              <label key={`${selectedRole.id}-${user.id}`} className="settings-role-member-row">
                                <span className="settings-role-member-meta">
                                  <span className="avatar">
                                    {user.avatarUrl ? (
                                      <img src={user.avatarUrl} alt={`${user.name} avatar`} />
                                    ) : (
                                      user.avatar
                                    )}
                                  </span>
                                  <span>
                                    <strong>{user.name}</strong>
                                    <small>{user.id}</small>
                                  </span>
                                </span>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={!canManageChannels}
                                  aria-label={`Assign ${selectedRole.name} to ${user.name}`}
                                  onChange={() => toggleRoleAssignment(user.id, selectedRole.id)}
                                />
                              </label>
                            );
                          })}
                        </div>
                      </section>
                    </>
                  )}
                </section>
              </div>

              <button className="primary" onClick={() => onSaveSettings(nextSettings)}>
                Save Roles
              </button>
            </section>
          )}

          {activeTab === "members" && (
            <section className="settings-panel">
              <h3>Members</h3>
              <p>{users.length} members in this server.</p>
              <div className="settings-member-list">
                {users.map((user) => (
                  <div key={user.id} className="settings-member-row">
                    <span className="avatar">
                      {user.avatarUrl ? <img src={user.avatarUrl} alt={`${user.name} avatar`} /> : user.avatar}
                    </span>
                    <div>
                      <p>{user.name}</p>
                      <small>{user.roles.join(", ") || "Member"}</small>
                      {customRoles.length > 0 ? (
                        <div className="settings-chip-list">
                          {customRoles.map((role) => {
                            const checked = (memberRoleIds[user.id] ?? []).includes(role.id);
                            return (
                              <label key={`${user.id}-${role.id}`} className="settings-checkbox-row">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleRoleAssignment(user.id, role.id)}
                                />
                                {role.name}
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <small>No custom roles created yet.</small>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button className="primary" onClick={() => onSaveSettings(nextSettings)}>
                Save Member Roles
              </button>
            </section>
          )}

          {activeTab === "channels" && (
            <section className="settings-panel">
              <h3>Channels & Categories</h3>
              <p>Drag to reorder. Use arrows as keyboard-accessible fallback.</p>
              {!canManageChannels && (
                <p>You can view channel structure, but only moderators/admins can edit it.</p>
              )}
              <div className="settings-create-row">
                <input
                  placeholder="new-category"
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  disabled={!canManageChannels}
                />
                <button
                  className="primary"
                  disabled={!canManageChannels}
                  onClick={async () => {
                    if (!newCategoryName.trim()) return;
                    await onCreateCategory(newCategoryName.trim());
                    setNewCategoryName("");
                  }}
                >
                  Add Category
                </button>
              </div>

              <div className="settings-categories">
                {channelCategories.map((category) => (
                  <div
                    key={category.id}
                    className="settings-category"
                    draggable={canManageChannels}
                    onDragStart={(event) => {
                      if (!canManageChannels) return;
                      event.dataTransfer.setData("application/x-fray-category-id", category.id);
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={async (event) => {
                      if (!canManageChannels) return;
                      event.preventDefault();
                      const sourceCategoryId = event.dataTransfer.getData(
                        "application/x-fray-category-id"
                      );
                      const sourceRoomId = event.dataTransfer.getData("application/x-fray-room-id");
                      if (sourceCategoryId && sourceCategoryId !== category.id) {
                        await onReorderCategory(sourceCategoryId, category.id);
                      }
                      if (sourceRoomId) {
                        await onMoveRoomToCategory(sourceRoomId, category.id);
                      }
                    }}
                  >
                    <div className="settings-category-header">
                      <strong>{category.name}</strong>
                      <div className="settings-inline-actions">
                        <button disabled={!canManageChannels} onClick={() => onMoveCategoryByStep(category.id, "up")}>↑</button>
                        <button disabled={!canManageChannels} onClick={() => onMoveCategoryByStep(category.id, "down")}>↓</button>
                        <button
                          disabled={!canManageChannels}
                          onClick={async () => {
                            const nextName = window.prompt("Rename category", category.name);
                            if (!nextName?.trim() || nextName.trim() === category.name) return;
                            await onRenameCategory(category.id, nextName.trim());
                          }}
                        >
                          Rename
                        </button>
                        {category.id !== "channels" && (
                          <button
                            disabled={!canDeleteChannels}
                            onClick={async () => {
                              const confirmed = window.confirm(
                                `Delete category "${category.name}"? Channels in it will move to Channels.`
                              );
                              if (!confirmed) return;
                              await onDeleteCategory(category.id);
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="settings-room-list">
                      {category.rooms.map((room) => (
                        <div
                          key={room.id}
                          className="settings-room-row"
                          draggable={canManageChannels}
                          onDragStart={(event) => {
                            if (!canManageChannels) return;
                            event.dataTransfer.setData("application/x-fray-room-id", room.id);
                          }}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={async (event) => {
                            if (!canManageChannels) return;
                            event.preventDefault();
                            const sourceRoomId = event.dataTransfer.getData("application/x-fray-room-id");
                            if (!sourceRoomId || sourceRoomId === room.id) return;
                            await onReorderRoom(sourceRoomId, room.id, category.id);
                          }}
                        >
                          <span>{roomTypeIcon(room)} {room.name}</span>
                          <div className="settings-inline-actions">
                            <select
                              aria-label={`Move ${room.name} to category`}
                              value={category.id}
                              onChange={(event) => onMoveRoomToCategory(room.id, event.target.value)}
                              disabled={!canManageChannels}
                            >
                              {channelCategories.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.name}
                                </option>
                              ))}
                            </select>
                            <button disabled={!canManageChannels} onClick={() => onMoveRoomByStep(room.id, "up")}>↑</button>
                            <button disabled={!canManageChannels} onClick={() => onMoveRoomByStep(room.id, "down")}>↓</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <section className="settings-subsection">
                <h4>Permission Overrides</h4>
                <p>Category rules inherit to channels. Channel rules can explicitly deny inherited allows.</p>

                <label className="settings-field">
                  Category Scope
                  <select
                    value={selectedPermissionCategory}
                    onChange={(event) => setSelectedPermissionCategory(event.target.value)}
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="settings-permission-grid">
                  {PERMISSION_ACTIONS.map((action) => (
                    <label key={`cat-${action}`} className="settings-field">
                      {action}
                      <select
                        value={ruleFor(selectedCategoryRules, action)}
                        disabled={!canManageChannels}
                        onChange={(event) =>
                          onSetCategoryPermissionRule(
                            selectedPermissionCategory,
                            action,
                            event.target.value as PermissionRule
                          )
                        }
                      >
                        <option value="inherit">Inherit</option>
                        <option value="allow">Allow</option>
                        <option value="deny">Deny</option>
                      </select>
                    </label>
                  ))}
                </div>

                <label className="settings-field">
                  Channel Override
                  <select
                    value={selectedPermissionRoom}
                    onChange={(event) => setSelectedPermissionRoom(event.target.value)}
                  >
                    {permissionRooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        #{room.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="settings-permission-grid">
                  {PERMISSION_ACTIONS.map((action) => (
                    <label key={`room-${action}`} className="settings-field">
                      {action}
                      <select
                        value={ruleFor(selectedRoomRules, action)}
                        disabled={!canManageChannels || !selectedPermissionRoom}
                        onChange={(event) =>
                          onSetRoomPermissionRule(
                            selectedPermissionRoom,
                            action,
                            event.target.value as PermissionRule
                          )
                        }
                      >
                        <option value="inherit">Inherit</option>
                        <option value="allow">Allow</option>
                        <option value="deny">Deny</option>
                      </select>
                    </label>
                  ))}
                </div>
              </section>
            </section>
          )}

          {activeTab === "invites" && (
            <section className="settings-panel">
              <h3>Invites</h3>
              <p>Set default invite behavior and copy a share link for this server.</p>
              <label className="settings-field">
                Link Expiry (Hours)
                <input
                  type="number"
                  min={1}
                  max={168}
                  value={linkExpiryHours}
                  onChange={(event) => setLinkExpiryHours(event.target.value)}
                />
              </label>
              <label className="settings-checkbox-row">
                <input
                  type="checkbox"
                  checked={requireInviteApproval}
                  onChange={(event) => setRequireInviteApproval(event.target.checked)}
                />
                Require moderator approval for new invite acceptances
              </label>
              <label className="settings-checkbox-row">
                <input
                  type="checkbox"
                  checked={allowGuestInvites}
                  onChange={(event) => setAllowGuestInvites(event.target.checked)}
                />
                Allow guests to create invite links
              </label>
              <div className="settings-invite-row">
                <input value={inviteLink} readOnly />
                <button
                  className="ghost"
                  onClick={async () => {
                    if (!navigator.clipboard?.writeText) return;
                    await navigator.clipboard.writeText(inviteLink);
                    setCopiedInvite(true);
                  }}
                >
                  {copiedInvite ? "Copied" : "Copy"}
                </button>
              </div>
              <button className="primary" onClick={() => onSaveSettings(nextSettings)}>
                Save Invite Settings
              </button>
            </section>
          )}

          {activeTab === "moderation" && (
            <section className="settings-panel">
              <h3>Safety & Moderation</h3>
              <p>Configure baseline safety defaults for this server.</p>
              <label className="settings-field">
                Content Safety Level
                <select
                  value={safetyLevel}
                  onChange={(event) =>
                    setSafetyLevel(event.target.value as ServerSettings["moderation"]["safetyLevel"])
                  }
                >
                  <option value="off">Off</option>
                  <option value="members_only">Members Only</option>
                  <option value="strict">Strict</option>
                </select>
              </label>
              <label className="settings-checkbox-row">
                <input
                  type="checkbox"
                  checked={blockUnknownMedia}
                  onChange={(event) => setBlockUnknownMedia(event.target.checked)}
                />
                Block unknown media links
              </label>
              <label className="settings-field">
                Audit Log Retention (Days)
                <input
                  type="number"
                  min={7}
                  max={365}
                  value={auditLogRetentionDays}
                  onChange={(event) => setAuditLogRetentionDays(event.target.value)}
                />
              </label>
              <button className="primary" onClick={() => onSaveSettings(nextSettings)}>
                Save Moderation Settings
              </button>

              <section className="settings-subsection">
                <h4>Moderation Audit</h4>
                {moderationAudit.length === 0 ? (
                  <p>No moderation events yet.</p>
                ) : (
                  <div className="settings-audit-list">
                    {moderationAudit.map((entry) => (
                      <div key={entry.id} className="settings-audit-row">
                        <div>
                          <strong>{entry.action}</strong>
                          <p>{entry.target}</p>
                        </div>
                        <div className="settings-audit-meta">
                          <span>{entry.actorId}</span>
                          <span>{new Date(entry.timestamp).toLocaleString()}</span>
                          <span>{entry.sourceEventId ?? "n/a"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </section>
          )}
        </div>
      </section>
    </div>
  );
};
