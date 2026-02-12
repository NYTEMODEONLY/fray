import {
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useState
} from "react";
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
  canDeleteChannels: boolean;
  onSelect: (roomId: string) => void;
  spaceName: string;
  isOnline: boolean;
  onToggleOnline: () => void;
  onCreateRoom: (payload: { name: string; type: Room["type"]; category?: string }) => void;
  onInvite: () => void;
  onOpenSpaceSettings: () => void;
  spaceSettingsEnabled: boolean;
  onOpenUserSettings: () => void;
  onMoveCategoryByStep: (categoryId: string, direction: "up" | "down") => Promise<void> | void;
  onReorderCategory: (sourceCategoryId: string, targetCategoryId: string) => Promise<void> | void;
  onMoveRoomByStep: (roomId: string, direction: "up" | "down") => Promise<void> | void;
  onMoveRoomToCategory: (roomId: string, categoryId: string) => Promise<void> | void;
  onReorderRoom: (
    sourceRoomId: string,
    targetRoomId: string,
    targetCategoryId?: string
  ) => Promise<void> | void;
  onDeleteCategory: (categoryId: string) => Promise<void> | void;
  onDeleteRoom: (roomId: string) => Promise<void> | void;
}

type ContextMenuState =
  | { kind: "room"; roomId: string; x: number; y: number }
  | { kind: "category"; categoryId: string; x: number; y: number }
  | null;

type DropHint =
  | { kind: "category"; id: string }
  | { kind: "category-body"; id: string }
  | { kind: "room"; id: string }
  | null;

type PendingDelete =
  | { kind: "room"; roomId: string; name: string }
  | { kind: "category"; categoryId: string; name: string }
  | null;

const DEFAULT_CATEGORY_ID = "channels";
const CONTEXT_MENU_WIDTH = 230;
const CONTEXT_MENU_HEIGHT = 520;

const clampMenuPoint = (x: number, y: number) => {
  if (typeof window === "undefined") return { x, y };
  return {
    x: Math.max(8, Math.min(x, window.innerWidth - CONTEXT_MENU_WIDTH)),
    y: Math.max(8, Math.min(y, window.innerHeight - CONTEXT_MENU_HEIGHT))
  };
};

const runSafely = (handler: () => void | Promise<void>) => {
  void Promise.resolve(handler()).catch(() => undefined);
};

const copyToClipboard = async (value: string) => {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;
  await navigator.clipboard.writeText(value);
};

export const ChannelList = ({
  me,
  rooms,
  categories,
  currentRoomId,
  canManageChannels,
  canDeleteChannels,
  onSelect,
  spaceName,
  isOnline,
  onToggleOnline,
  onCreateRoom,
  onInvite,
  onOpenSpaceSettings,
  spaceSettingsEnabled,
  onOpenUserSettings,
  onMoveCategoryByStep,
  onReorderCategory,
  onMoveRoomByStep,
  onMoveRoomToCategory,
  onReorderRoom,
  onDeleteCategory,
  onDeleteRoom
}: ChannelListProps) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<Room["type"]>("text");
  const [newCategory, setNewCategory] = useState(categories[0]?.id ?? DEFAULT_CATEGORY_ID);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [draggingCategoryId, setDraggingCategoryId] = useState<string | null>(null);
  const [draggingRoomId, setDraggingRoomId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<DropHint>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [deleteInFlight, setDeleteInFlight] = useState(false);

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
        const categoryId = room.category ?? DEFAULT_CATEGORY_ID;
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

  const roomById = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms]);
  const categoryById = useMemo(() => new Map(grouped.map((category) => [category.id, category])), [grouped]);

  useEffect(() => {
    if (!categories.length) return;
    if (categories.some((category) => category.id === newCategory)) return;
    setNewCategory(categories[0].id);
  }, [categories, newCategory]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setContextMenu(null);
      setDropHint(null);
      setPendingDelete(null);
    };
    const handleResize = () => setContextMenu(null);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const dms = rooms.filter((room) => room.type === "dm");
  const categoryOptions = grouped.map((group) => group.id);

  const clearDragState = () => {
    setDraggingCategoryId(null);
    setDraggingRoomId(null);
    setDropHint(null);
  };

  const runContextAction = (handler: () => void | Promise<void>) => {
    setContextMenu(null);
    runSafely(handler);
  };

  const openRoomContextMenu = (event: ReactMouseEvent, roomId: string) => {
    event.preventDefault();
    const point = clampMenuPoint(event.clientX, event.clientY);
    setContextMenu({ kind: "room", roomId, x: point.x, y: point.y });
  };

  const openCategoryContextMenu = (event: ReactMouseEvent, categoryId: string) => {
    event.preventDefault();
    const point = clampMenuPoint(event.clientX, event.clientY);
    setContextMenu({ kind: "category", categoryId, x: point.x, y: point.y });
  };

  const openRoomDeletePrompt = (roomId: string) => {
    const room = roomById.get(roomId);
    if (!room) return;
    setPendingDelete({ kind: "room", roomId, name: room.name });
  };

  const openCategoryDeletePrompt = (categoryId: string) => {
    const category = categoryById.get(categoryId);
    if (!category || category.id === DEFAULT_CATEGORY_ID) return;
    setPendingDelete({ kind: "category", categoryId, name: category.name });
  };

  const confirmDelete = () => {
    if (!pendingDelete || deleteInFlight) return;
    const target = pendingDelete;
    setDeleteInFlight(true);
    runSafely(async () => {
      try {
        if (target.kind === "room") {
          await onDeleteRoom(target.roomId);
        } else {
          await onDeleteCategory(target.categoryId);
        }
      } finally {
        setDeleteInFlight(false);
        setPendingDelete(null);
      }
    });
  };

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    onCreateRoom({ name, type: newType, category: newCategory });
    setNewName("");
    setShowCreate(false);
  };

  const handleDropOnCategory = (event: ReactDragEvent<HTMLElement>, targetCategoryId: string) => {
    if (!canManageChannels) return;
    event.preventDefault();
    event.stopPropagation();

    if (draggingCategoryId && draggingCategoryId !== targetCategoryId && targetCategoryId !== DEFAULT_CATEGORY_ID) {
      runSafely(() => onReorderCategory(draggingCategoryId, targetCategoryId));
    } else if (draggingRoomId) {
      runSafely(() => onMoveRoomToCategory(draggingRoomId, targetCategoryId));
    }

    clearDragState();
  };

  return (
    <aside className="channel-panel" onDragEnd={clearDragState}>
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
            title={spaceSettingsEnabled ? "Server settings" : "Server settings unavailable"}
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
          const isCategoryDropTarget = dropHint?.kind === "category" && dropHint.id === categoryGroup.id;
          const isCategoryBodyDropTarget =
            dropHint?.kind === "category-body" && dropHint.id === categoryGroup.id;
          const categoryClassName = [
            "channel-category",
            isCategoryDropTarget ? "drop-target-category" : "",
            isCategoryBodyDropTarget ? "drop-target-category-body" : "",
            draggingCategoryId === categoryGroup.id ? "dragging-category" : ""
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <section
              key={categoryGroup.id}
              className={categoryClassName}
              onDragOver={(event) => {
                if (!canManageChannels) return;
                const canDropCategory =
                  Boolean(draggingCategoryId) &&
                  draggingCategoryId !== categoryGroup.id &&
                  categoryGroup.id !== DEFAULT_CATEGORY_ID;
                const canDropRoom = Boolean(draggingRoomId);
                if (!canDropCategory && !canDropRoom) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropHint({ kind: "category", id: categoryGroup.id });
              }}
              onDrop={(event) => handleDropOnCategory(event, categoryGroup.id)}
            >
              <button
                className="category-toggle"
                draggable={canManageChannels && categoryGroup.id !== DEFAULT_CATEGORY_ID}
                onDragStart={(event) => {
                  if (!canManageChannels || categoryGroup.id === DEFAULT_CATEGORY_ID) return;
                  event.dataTransfer.effectAllowed = "move";
                  setDraggingCategoryId(categoryGroup.id);
                  setDraggingRoomId(null);
                }}
                onDragEnd={clearDragState}
                onContextMenu={(event) => openCategoryContextMenu(event, categoryGroup.id)}
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
                <div
                  className="channel-list"
                  onDragOver={(event) => {
                    if (!canManageChannels || !draggingRoomId) return;
                    event.preventDefault();
                    event.stopPropagation();
                    event.dataTransfer.dropEffect = "move";
                    setDropHint({ kind: "category-body", id: categoryGroup.id });
                  }}
                  onDrop={(event) => {
                    if (!canManageChannels || !draggingRoomId) return;
                    event.preventDefault();
                    event.stopPropagation();
                    runSafely(() => onMoveRoomToCategory(draggingRoomId, categoryGroup.id));
                    clearDragState();
                  }}
                >
                  {categoryGroup.rooms.map((room) => {
                    const roomIsDropTarget = dropHint?.kind === "room" && dropHint.id === room.id;
                    const roomClasses = [
                      room.id === currentRoomId ? "channel active" : room.isWelcome ? "channel welcome" : "channel",
                      roomIsDropTarget ? "drop-target-room" : "",
                      draggingRoomId === room.id ? "dragging-room" : ""
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <button
                        key={room.id}
                        className={roomClasses}
                        draggable={canManageChannels}
                        onDragStart={(event) => {
                          if (!canManageChannels) return;
                          event.dataTransfer.effectAllowed = "move";
                          setDraggingRoomId(room.id);
                          setDraggingCategoryId(null);
                        }}
                        onDragOver={(event) => {
                          if (!canManageChannels || !draggingRoomId || draggingRoomId === room.id) return;
                          event.preventDefault();
                          event.stopPropagation();
                          event.dataTransfer.dropEffect = "move";
                          setDropHint({ kind: "room", id: room.id });
                        }}
                        onDrop={(event) => {
                          if (!canManageChannels || !draggingRoomId || draggingRoomId === room.id) return;
                          event.preventDefault();
                          event.stopPropagation();
                          runSafely(() => onReorderRoom(draggingRoomId, room.id, categoryGroup.id));
                          clearDragState();
                        }}
                        onContextMenu={(event) => openRoomContextMenu(event, room.id)}
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
                    );
                  })}
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
                onContextMenu={(event) => openRoomContextMenu(event, room.id)}
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

      {contextMenu && (
        <div
          className="context-menu-layer"
          onMouseDown={() => setContextMenu(null)}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div
            className="context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            {contextMenu.kind === "room" && roomById.get(contextMenu.roomId) && (
              <>
                <button onClick={() => runContextAction(() => onSelect(contextMenu.roomId))}>
                  Open channel
                </button>
                <button onClick={() => runContextAction(() => copyToClipboard(contextMenu.roomId))}>
                  Copy channel ID
                </button>
                {(canManageChannels || canDeleteChannels) &&
                  roomById.get(contextMenu.roomId)?.type !== "dm" && (
                  <>
                    <div className="context-menu-separator" />
                    {canManageChannels && (
                      <>
                        <button onClick={() => runContextAction(() => onMoveRoomByStep(contextMenu.roomId, "up"))}>
                          Move channel up
                        </button>
                        <button onClick={() => runContextAction(() => onMoveRoomByStep(contextMenu.roomId, "down"))}>
                          Move channel down
                        </button>
                        {grouped
                          .filter((category) => category.id !== (roomById.get(contextMenu.roomId)?.category ?? DEFAULT_CATEGORY_ID))
                          .map((category) => (
                            <button
                              key={`${contextMenu.roomId}-${category.id}`}
                              onClick={() =>
                                runContextAction(() => onMoveRoomToCategory(contextMenu.roomId, category.id))
                              }
                            >
                              Move to {category.name}
                            </button>
                          ))}
                      </>
                    )}
                    {canDeleteChannels && (
                      <button
                        className="danger"
                        onClick={() => runContextAction(() => openRoomDeletePrompt(contextMenu.roomId))}
                      >
                        Delete channel
                      </button>
                    )}
                  </>
                )}
              </>
            )}

            {contextMenu.kind === "category" && categoryById.get(contextMenu.categoryId) && (
              <>
                <button
                  onClick={() =>
                    runContextAction(() =>
                      setCollapsed((state) => ({
                        ...state,
                        [contextMenu.categoryId]: !state[contextMenu.categoryId]
                      }))
                    )
                  }
                >
                  {collapsed[contextMenu.categoryId] ? "Expand category" : "Collapse category"}
                </button>
                <button onClick={() => runContextAction(() => copyToClipboard(contextMenu.categoryId))}>
                  Copy category ID
                </button>
                {(canManageChannels || canDeleteChannels) &&
                  contextMenu.categoryId !== DEFAULT_CATEGORY_ID && (
                  <>
                    <div className="context-menu-separator" />
                    {canManageChannels && (
                      <>
                        <button
                          onClick={() => runContextAction(() => onMoveCategoryByStep(contextMenu.categoryId, "up"))}
                        >
                          Move category up
                        </button>
                        <button
                          onClick={() =>
                            runContextAction(() => onMoveCategoryByStep(contextMenu.categoryId, "down"))
                          }
                        >
                          Move category down
                        </button>
                      </>
                    )}
                    {canDeleteChannels && (
                      <button
                        className="danger"
                        onClick={() =>
                          runContextAction(() => openCategoryDeletePrompt(contextMenu.categoryId))
                        }
                      >
                        Delete category
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {pendingDelete && (
        <div
          className="settings-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Delete confirmation"
          onMouseDown={() => {
            if (!deleteInFlight) {
              setPendingDelete(null);
            }
          }}
        >
          <section className="delete-confirm-card" onMouseDown={(event) => event.stopPropagation()}>
            <h3>{pendingDelete.kind === "room" ? "Delete channel?" : "Delete category?"}</h3>
            <p>
              {pendingDelete.kind === "room"
                ? `Delete channel "${pendingDelete.name}" permanently from Synapse? This cannot be undone.`
                : `Delete category "${pendingDelete.name}"? Channels in it will move to Channels.`}
            </p>
            <div className="delete-confirm-actions">
              <button
                className="ghost"
                onClick={() => setPendingDelete(null)}
                disabled={deleteInFlight}
              >
                Cancel
              </button>
              <button className="pill warn" onClick={confirmDelete} disabled={deleteInFlight}>
                {deleteInFlight
                  ? "Deleting..."
                  : pendingDelete.kind === "room"
                    ? "Delete channel"
                    : "Delete category"}
              </button>
            </div>
          </section>
        </div>
      )}
    </aside>
  );
};
