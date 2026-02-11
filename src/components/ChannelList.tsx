import { useEffect, useMemo, useState } from "react";
import { Category, Room, User } from "../types";
import {
  ChevronDown,
  ChevronRight,
  Circle,
  Hash,
  MessageCircle,
  Settings,
  UserPlus,
  Video,
  Volume2
} from "lucide-react";

interface ChannelListProps {
  me: User;
  rooms: Room[];
  categories: Category[];
  currentRoomId: string;
  canManageChannels: boolean;
  onSelect: (roomId: string) => void;
  spaceName: string;
  isOnline: boolean;
  onToggleOnline: () => void;
  onCreateRoom: (payload: { name: string; type: Room["type"]; category?: string }) => void;
  onInvite: () => void;
  onOpenSpaceSettings: () => void;
  spaceSettingsEnabled: boolean;
  onOpenUserSettings: () => void;
}

export const ChannelList = ({
  me,
  rooms,
  categories,
  currentRoomId,
  canManageChannels,
  onSelect,
  spaceName,
  isOnline,
  onToggleOnline,
  onCreateRoom,
  onInvite,
  onOpenSpaceSettings,
  spaceSettingsEnabled,
  onOpenUserSettings
}: ChannelListProps) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<Room["type"]>("text");
  const [newCategory, setNewCategory] = useState(categories[0]?.id ?? "channels");

  const grouped = useMemo(() => {
    const categoryMap = new Map(
      categories.map((category) => [
        category.id,
        {
          id: category.id,
          name: category.name,
          order: category.order,
          rooms: [] as Room[]
        }
      ])
    );

    rooms
      .filter((room) => room.type !== "dm")
      .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
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
    return Array.from(categoryMap.values()).sort((left, right) => left.order - right.order);
  }, [rooms, categories]);

  useEffect(() => {
    if (!categories.length) return;
    if (categories.some((category) => category.id === newCategory)) return;
    setNewCategory(categories[0].id);
  }, [categories, newCategory]);

  const dms = rooms.filter((room) => room.type === "dm");
  const categoryOptions = grouped.map((group) => group.id);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    onCreateRoom({ name, type: newType, category: newCategory });
    setNewName("");
    setShowCreate(false);
  };

  return (
    <aside className="channel-panel">
      <div className="channel-panel-header">
        <div>
          <p className="eyebrow">Server</p>
          <h2 className="space-title">{spaceName}</h2>
        </div>
        <div className="channel-panel-header-actions">
          <button
            className="icon-button"
            aria-label="Space settings"
            onClick={onOpenSpaceSettings}
            disabled={!spaceSettingsEnabled}
            title={spaceSettingsEnabled ? "Server settings" : "Server settings require a specific server"}
          >
            <Settings size={16} aria-hidden="true" />
          </button>
          <button className="icon-button" aria-label="Invite" onClick={onInvite}>
            <UserPlus size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="channel-scroll">
        {grouped.map((categoryGroup) => {
          const isCollapsed = collapsed[categoryGroup.id];
          return (
            <section key={categoryGroup.id} className="channel-category">
              <button
                className="category-toggle"
                onClick={() =>
                  setCollapsed((state) => ({
                    ...state,
                    [categoryGroup.id]: !state[categoryGroup.id]
                  }))
                }
              >
                <span className="category-toggle-icon">
                  {isCollapsed ? <ChevronRight size={13} aria-hidden="true" /> : <ChevronDown size={13} aria-hidden="true" />}
                </span>
                {categoryGroup.name}
              </button>
              {!isCollapsed && (
                <div className="channel-list">
                  {categoryGroup.rooms.map((room) => (
                    <button
                      key={room.id}
                      className={
                        room.id === currentRoomId
                          ? "channel active"
                          : room.isWelcome
                            ? "channel welcome"
                            : "channel"
                      }
                      onClick={() => onSelect(room.id)}
                    >
                      <span className="channel-type">
                        {room.type === "text" ? (
                          <Hash size={15} aria-hidden="true" />
                        ) : room.type === "voice" ? (
                          <Volume2 size={15} aria-hidden="true" />
                        ) : (
                          <Video size={15} aria-hidden="true" />
                        )}
                      </span>
                      <span className="channel-name">{room.name}</span>
                      {room.unreadCount > 0 && (
                        <span className="badge">{room.unreadCount}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </section>
          );
        })}

        <section className="channel-category">
          <div className="category-toggle static">
            <span className="category-toggle-icon">
              <Circle size={6} fill="currentColor" aria-hidden="true" />
            </span>
            direct messages
          </div>
          <div className="channel-list">
            {dms.map((room) => (
              <button
                key={room.id}
                className={room.id === currentRoomId ? "channel active" : "channel"}
                onClick={() => onSelect(room.id)}
              >
                <span className="channel-type">
                  <MessageCircle size={15} aria-hidden="true" />
                </span>
                <span className="channel-name">{room.name}</span>
                {room.unreadCount > 0 && <span className="badge">{room.unreadCount}</span>}
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="channel-panel-footer">
        <button
          className="ghost"
          onClick={() => setShowCreate((state) => !state)}
          disabled={!canManageChannels}
          title={!canManageChannels ? "Manage Channels permission required" : undefined}
        >
          {showCreate ? "Close" : "New Channel"}
        </button>
        <button className={isOnline ? "pill online" : "pill offline"} onClick={onToggleOnline}>
          {isOnline ? "Online" : "Offline"}
        </button>
      </div>

      {showCreate && (
        <div className="channel-create">
          <p className="eyebrow">Create Channel</p>
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="channel-name"
            disabled={!canManageChannels}
          />
          <div className="create-row">
            <label>
              Type
              <select
                value={newType}
                onChange={(event) => setNewType(event.target.value as Room["type"])}
                disabled={!canManageChannels}
              >
                <option value="text">Text</option>
                <option value="voice">Voice</option>
                <option value="video">Video</option>
              </select>
            </label>
            <label>
              Category
              <select
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value)}
                disabled={!canManageChannels}
              >
                {categoryOptions.map((categoryId) => {
                  const categoryName =
                    categories.find((category) => category.id === categoryId)?.name ?? categoryId;
                  return (
                    <option key={categoryId} value={categoryId}>
                      {categoryName}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>
          <button className="primary" onClick={handleCreate} disabled={!canManageChannels}>
            Create
          </button>
        </div>
      )}

      <div className="channel-account">
        <div className="channel-account-avatar-wrap">
          <div className="avatar me">
            {me.avatarUrl ? <img src={me.avatarUrl} alt={`${me.name} avatar`} /> : me.avatar}
          </div>
          <span className={`status-dot ${me.status}`} />
        </div>
        <div className="channel-account-meta">
          <p>{me.name}</p>
          <small>{me.status}</small>
        </div>
        <div className="channel-account-actions">
          <button className="icon-button" aria-label="User settings" onClick={onOpenUserSettings}>
            <Settings size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
};
