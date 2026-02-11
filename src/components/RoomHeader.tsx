import { Room } from "../types";
import { RoomSearchFilter } from "../services/messagePresentationService";
import {
  Bell,
  ChevronDown,
  ChevronUp,
  Command,
  Hash,
  MessageCircle,
  Pin,
  Power,
  Settings,
  Users,
  Video,
  Volume2
} from "lucide-react";

interface RoomHeaderProps {
  room?: Room;
  searchQuery: string;
  onSearch: (value: string) => void;
  searchFilter: RoomSearchFilter;
  onSearchFilterChange: (value: RoomSearchFilter) => void;
  searchResultCount: number;
  activeSearchResultIndex: number;
  onSearchPrev: () => void;
  onSearchNext: () => void;
  onJumpToSearchResult: () => void;
  onToggleMembers: () => void;
  onTogglePins: () => void;
  onSimulate: () => void;
  isOnline: boolean;
  onToggleOnline: () => void;
  enterToSend: boolean;
  onToggleEnterToSend: () => void;
  messageDensity: "cozy" | "compact";
  onToggleMessageDensity: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onOpenUserSettings: () => void;
  onOpenCommandPalette: () => void;
  onLogout?: () => void;
}

export const RoomHeader = ({
  room,
  searchQuery,
  onSearch,
  searchFilter,
  onSearchFilterChange,
  searchResultCount,
  activeSearchResultIndex,
  onSearchPrev,
  onSearchNext,
  onJumpToSearchResult,
  onToggleMembers,
  onTogglePins,
  onSimulate,
  onOpenUserSettings,
  onOpenCommandPalette,
  onLogout
}: RoomHeaderProps) => (
  <header className="room-header">
    <div className="room-title">
      <span className="room-icon">
        {room?.type === "text" ? (
          <Hash size={17} aria-hidden="true" />
        ) : room?.type === "dm" ? (
          <MessageCircle size={17} aria-hidden="true" />
        ) : room?.type === "voice" ? (
          <Volume2 size={17} aria-hidden="true" />
        ) : (
          <Video size={17} aria-hidden="true" />
        )}
      </span>
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
        <select
          aria-label="Search filter"
          value={searchFilter}
          onChange={(event) => onSearchFilterChange(event.target.value as RoomSearchFilter)}
        >
          <option value="all">All</option>
          <option value="mentions">Mentions</option>
          <option value="has_links">Has links</option>
          <option value="from_me">From me</option>
        </select>
        <button
          className="icon-button"
          onClick={onSearchPrev}
          aria-label="Previous search result"
          disabled={searchResultCount === 0}
        >
          <ChevronUp size={14} aria-hidden="true" />
        </button>
        <button
          className="icon-button"
          onClick={onSearchNext}
          aria-label="Next search result"
          disabled={searchResultCount === 0}
        >
          <ChevronDown size={14} aria-hidden="true" />
        </button>
        <button
          className="pill"
          onClick={onJumpToSearchResult}
          disabled={searchResultCount === 0}
        >
          {searchResultCount > 0 ? `${activeSearchResultIndex}/${searchResultCount}` : "0/0"}
        </button>
      </div>

      <div className="room-toolbar" aria-label="Channel actions">
        <button className="icon-button" onClick={onOpenCommandPalette} aria-label="Quick Switch">
          <Command size={14} aria-hidden="true" />
        </button>
        <button className="icon-button" onClick={onTogglePins} aria-label="Pinned messages">
          <Pin size={14} aria-hidden="true" />
        </button>
        <button className="icon-button" onClick={onToggleMembers} aria-label="Toggle members">
          <Users size={14} aria-hidden="true" />
        </button>
        <button className="icon-button" onClick={onOpenUserSettings} aria-label="User settings">
          <Settings size={14} aria-hidden="true" />
        </button>
        <button className="icon-button" onClick={onSimulate} aria-label="Simulate Ping">
          <Bell size={14} aria-hidden="true" />
        </button>
        {onLogout && (
          <button className="icon-button" onClick={onLogout} aria-label="Logout">
            <Power size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  </header>
);
