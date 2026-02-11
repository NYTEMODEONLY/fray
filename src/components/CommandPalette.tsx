import { useEffect, useMemo, useRef, useState } from "react";
import { Room, Space } from "../types";
import { X } from "lucide-react";

interface CommandPaletteProps {
  isOpen: boolean;
  spaces: Space[];
  rooms: Room[];
  currentSpaceId: string;
  currentRoomId: string;
  onClose: () => void;
  onSelectSpace: (spaceId: string) => void;
  onSelectRoom: (roomId: string) => void;
  onOpenUserSettings: () => void;
  onOpenServerSettings: () => void;
  onToggleMembers: () => void;
  onTogglePins: () => void;
  onJumpToLatest: () => void;
}

interface CommandItem {
  id: string;
  title: string;
  subtitle: string;
  kind: "action" | "space" | "room";
  run: () => void;
}

const roomPrefix = (type: Room["type"]) => {
  if (type === "text") return "#";
  if (type === "dm") return "@";
  if (type === "voice") return "voice/";
  return "video/";
};

export const CommandPalette = ({
  isOpen,
  spaces,
  rooms,
  currentSpaceId,
  currentRoomId,
  onClose,
  onSelectSpace,
  onSelectRoom,
  onOpenUserSettings,
  onOpenServerSettings,
  onToggleMembers,
  onTogglePins,
  onJumpToLatest
}: CommandPaletteProps) => {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const commandItems = useMemo<CommandItem[]>(() => {
    const actions: CommandItem[] = [
      {
        id: "action-user-settings",
        title: "Open User Settings",
        subtitle: "Preferences and accessibility",
        kind: "action",
        run: onOpenUserSettings
      },
      {
        id: "action-server-settings",
        title: "Open Server Settings",
        subtitle: "Manage channels, roles, invites",
        kind: "action",
        run: onOpenServerSettings
      },
      {
        id: "action-toggle-members",
        title: "Toggle Members Panel",
        subtitle: "Show or hide members",
        kind: "action",
        run: onToggleMembers
      },
      {
        id: "action-toggle-pins",
        title: "Toggle Pins Panel",
        subtitle: "Open pinned messages",
        kind: "action",
        run: onTogglePins
      },
      {
        id: "action-jump-latest",
        title: "Jump to Latest",
        subtitle: "Scroll to newest message",
        kind: "action",
        run: onJumpToLatest
      }
    ];

    const spaceItems = spaces.map<CommandItem>((space) => ({
      id: `space-${space.id}`,
      title: space.name,
      subtitle: "Switch server",
      kind: "space",
      run: () => onSelectSpace(space.id)
    }));

    const roomItems = rooms.map<CommandItem>((room) => ({
      id: `room-${room.id}`,
      title: `${roomPrefix(room.type)}${room.name}`,
      subtitle: `Switch channel${
        room.id === currentRoomId
          ? " (current)"
          : room.spaceId !== currentSpaceId
            ? " (other server)"
            : ""
      }`,
      kind: "room",
      run: () => {
        if (room.spaceId !== currentSpaceId) {
          onSelectSpace(room.spaceId);
        }
        onSelectRoom(room.id);
      }
    }));

    return [...actions, ...spaceItems, ...roomItems];
  }, [
    currentSpaceId,
    currentRoomId,
    onJumpToLatest,
    onOpenServerSettings,
    onOpenUserSettings,
    onSelectRoom,
    onSelectSpace,
    onToggleMembers,
    onTogglePins,
    rooms,
    spaces
  ]);

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commandItems;
    return commandItems.filter((item) =>
      `${item.title} ${item.subtitle}`.toLowerCase().includes(needle)
    );
  }, [commandItems, query]);

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setActiveIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [isOpen]);

  useEffect(() => {
    if (!filteredItems.length) return;
    if (activeIndex < filteredItems.length) return;
    setActiveIndex(0);
  }, [filteredItems, activeIndex]);

  if (!isOpen) return null;

  const execute = (index: number) => {
    const target = filteredItems[index];
    if (!target) return;
    target.run();
    onClose();
  };

  return (
    <div
      className="settings-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section className="command-palette" onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
          return;
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setActiveIndex((current) => {
            if (!filteredItems.length) return 0;
            return (current + 1) % filteredItems.length;
          });
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setActiveIndex((current) => {
            if (!filteredItems.length) return 0;
            return (current - 1 + filteredItems.length) % filteredItems.length;
          });
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          execute(activeIndex);
        }
      }}>
        <div className="command-palette-header">
          <input
            ref={inputRef}
            type="search"
            placeholder="Search channels, servers, and commands..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button className="icon-button" onClick={onClose} aria-label="Close command palette">
            <X size={14} aria-hidden="true" />
          </button>
        </div>
        <div className="command-palette-list">
          {filteredItems.length === 0 && (
            <p className="empty">No matching commands.</p>
          )}
          {filteredItems.map((item, index) => (
            <button
              key={item.id}
              className={index === activeIndex ? "command-item active" : "command-item"}
              onClick={() => execute(index)}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <span className="command-item-title">{item.title}</span>
              <span className="command-item-subtitle">{item.subtitle}</span>
              <span className="command-item-kind">{item.kind}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
