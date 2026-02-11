import { Space } from "../types";
import { Plus } from "lucide-react";

interface ServerRailProps {
  spaces: Space[];
  currentSpaceId: string;
  onSelect: (spaceId: string) => void;
  onCreateSpace: () => void;
}

export const ServerRail = ({ spaces, currentSpaceId, onSelect, onCreateSpace }: ServerRailProps) => (
  <aside className="server-rail">
    <div className="brand">fray</div>
    <div className="server-list">
      {spaces.map((space) => (
        <button
          key={space.id}
          className={space.id === currentSpaceId ? "server active" : "server"}
          onClick={() => onSelect(space.id)}
          aria-label={space.name}
        >
          <span>{space.icon}</span>
        </button>
      ))}
    </div>
    <div className="server-rail-footer">
      <button className="server ghost" aria-label="Create space" onClick={onCreateSpace}>
        <Plus size={18} aria-hidden="true" />
      </button>
    </div>
  </aside>
);
