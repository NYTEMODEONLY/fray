import { Room } from "../types";

interface RoomHeaderProps {
  room?: Room;
  searchQuery: string;
  onSearch: (value: string) => void;
  onToggleMembers: () => void;
  onTogglePins: () => void;
  onSimulate: () => void;
  isOnline: boolean;
  onToggleOnline: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onLogout?: () => void;
}

export const RoomHeader = ({
  room,
  searchQuery,
  onSearch,
  onToggleMembers,
  onTogglePins,
  onSimulate,
  isOnline,
  onToggleOnline,
  theme,
  onToggleTheme,
  onLogout
}: RoomHeaderProps) => (
  <header className="room-header">
    <div className="room-title">
      <span className="room-icon">{room?.type === "text" ? "#" : room?.type === "dm" ? "✉" : room?.type === "voice" ? "🔊" : "📹"}</span>
      <div>
        <h1>{room?.name ?? ""}</h1>
        <p>{room?.topic ?? ""}</p>
      </div>
    </div>

    <div className="room-actions">
      <div className="search">
        <input
          type="search"
          placeholder="Search messages"
          value={searchQuery}
          onChange={(event) => onSearch(event.target.value)}
        />
      </div>
      <button className="icon-button" onClick={onTogglePins} aria-label="Pinned messages">
        📌
      </button>
      <button className="icon-button" onClick={onToggleMembers} aria-label="Toggle members">
        👥
      </button>
      <button className={isOnline ? "pill online" : "pill offline"} onClick={onToggleOnline}>
        {isOnline ? "Online" : "Offline"}
      </button>
      <button className="pill" onClick={onToggleTheme}>
        {theme === "dark" ? "Light" : "Dark"}
      </button>
      <button className="pill ghost" onClick={onSimulate}>
        Simulate Ping
      </button>
      {onLogout && (
        <button className="pill ghost" onClick={onLogout}>
          Logout
        </button>
      )}
    </div>
  </header>
);
