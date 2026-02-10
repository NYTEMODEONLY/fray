import { Room } from "../types";

interface UnreadFeedProps {
  rooms: Room[];
  onSelect: (roomId: string) => void;
}

export const UnreadFeed = ({ rooms, onSelect }: UnreadFeedProps) => {
  const unread = rooms.filter((room) => room.unreadCount > 0 && room.type === "text");
  if (unread.length === 0) return null;

  return (
    <div className="unread-feed">
      <p className="eyebrow">Smart Unread</p>
      <div className="unread-list">
        {unread.map((room) => (
          <button key={room.id} onClick={() => onSelect(room.id)}>
            #{room.name}
            <span>{room.unreadCount}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
