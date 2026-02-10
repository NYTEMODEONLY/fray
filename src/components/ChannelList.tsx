import { useMemo, useState } from "react";
import { Room } from "../types";

interface ChannelListProps {
  rooms: Room[];
  currentRoomId: string;
  onSelect: (roomId: string) => void;
  spaceName: string;
}

export const ChannelList = ({
  rooms,
  currentRoomId,
  onSelect,
  spaceName
}: ChannelListProps) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

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
        <button className="ghost">New Channel</button>
        <button className="primary">Invite</button>
      </div>
    </aside>
  );
};
