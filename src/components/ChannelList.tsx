import { useMemo, useState } from "react";
import { Room } from "../types";

interface ChannelListProps {
  rooms: Room[];
  currentRoomId: string;
  onSelect: (roomId: string) => void;
  spaceName: string;
  onCreateRoom: (payload: { name: string; type: Room["type"]; category?: string }) => void;
}

export const ChannelList = ({
  rooms,
  currentRoomId,
  onSelect,
  spaceName,
  onCreateRoom
}: ChannelListProps) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<Room["type"]>("text");
  const [newCategory, setNewCategory] = useState("community");

  const grouped = useMemo(() => {
    const categories = new Map<string, Room[]>();
    rooms
      .filter((room) => room.type !== "dm")
      .forEach((room) => {
        const category = room.category ?? "channels";
        const current = categories.get(category) ?? [];
        current.push(room);
        categories.set(category, current);
      });
    return Array.from(categories.entries());
  }, [rooms]);

  const dms = rooms.filter((room) => room.type === "dm");
  const categories = grouped.map(([category]) => category);

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
          <p className="eyebrow">Space</p>
          <h2 className="space-title">{spaceName}</h2>
        </div>
        <button className="icon-button" aria-label="Space settings">
          ⚙
        </button>
      </div>

      <div className="channel-scroll">
        {grouped.map(([category, categoryRooms]) => {
          const isCollapsed = collapsed[category];
          return (
            <section key={category} className="channel-category">
              <button
                className="category-toggle"
                onClick={() =>
                  setCollapsed((state) => ({
                    ...state,
                    [category]: !state[category]
                  }))
                }
              >
                <span>{isCollapsed ? "+" : "-"}</span>
                {category}
              </button>
              {!isCollapsed && (
                <div className="channel-list">
                  {categoryRooms.map((room) => (
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
                        {room.type === "text" ? "#" : room.type === "voice" ? "🔊" : "📹"}
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
            <span>•</span>direct messages
          </div>
          <div className="channel-list">
            {dms.map((room) => (
              <button
                key={room.id}
                className={room.id === currentRoomId ? "channel active" : "channel"}
                onClick={() => onSelect(room.id)}
              >
                <span className="channel-type">✉</span>
                <span className="channel-name">{room.name}</span>
                {room.unreadCount > 0 && <span className="badge">{room.unreadCount}</span>}
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="channel-panel-footer">
        <button className="ghost" onClick={() => setShowCreate((state) => !state)}>
          {showCreate ? "Close" : "New Channel"}
        </button>
        <button className="primary">Invite</button>
      </div>

      {showCreate && (
        <div className="channel-create">
          <p className="eyebrow">Create Channel</p>
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="channel-name"
          />
          <div className="create-row">
            <label>
              Type
              <select value={newType} onChange={(event) => setNewType(event.target.value as Room["type"])}>
                <option value="text">Text</option>
                <option value="voice">Voice</option>
                <option value="video">Video</option>
              </select>
            </label>
            <label>
              Category
              <input
                list="category-list"
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value)}
                placeholder="category"
              />
            </label>
            <datalist id="category-list">
              {categories.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </div>
          <button className="primary" onClick={handleCreate}>
            Create
          </button>
        </div>
      )}
    </aside>
  );
};
