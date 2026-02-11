import { useEffect, useMemo, useState } from "react";
import {
  Category,
  ModerationAuditEvent,
  PERMISSION_ACTIONS,
  PermissionAction,
  PermissionRule,
  PermissionRuleSet,
  Room,
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
    defaultLevel: 0
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

export const ServerSettingsModal = ({
  space,
  rooms,
  categories,
  settings,
  permissionOverrides,
  moderationAudit,
  canManageChannels,
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

  const roleSet = useMemo(() => Array.from(new Set(users.flatMap((user) => user.roles))), [users]);
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
      defaultLevel: parseInteger(defaultLevel, activeSettings.roles.defaultLevel, 0, 100)
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
              <p>Map familiar role tiers to Matrix power levels for this server.</p>
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
              <div className="settings-chip-list">
                {roleSet.map((role) => (
                  <span key={role} className="role">
                    {role}
                  </span>
                ))}
              </div>
              <button className="primary" onClick={() => onSaveSettings(nextSettings)}>
                Save Role Defaults
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
                      <small>{user.roles.join(", ")}</small>
                    </div>
                  </div>
                ))}
              </div>
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
                          <button disabled={!canManageChannels} onClick={() => onDeleteCategory(category.id)}>Delete</button>
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
