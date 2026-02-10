import { Space } from "../types";

interface ServerRailProps {
  spaces: Space[];
  currentSpaceId: string;
  onSelect: (spaceId: string) => void;
}

export const ServerRail = ({ spaces, currentSpaceId, onSelect }: ServerRailProps) => (
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
      <button className="server ghost" aria-label="Create space">
        +
      </button>
    </div>
  </aside>
);
