import { type MouseEvent as ReactMouseEvent, useEffect, useMemo, useState } from "react";
import { User } from "../types";

interface MemberListProps {
  users: User[];
}

interface MemberContextMenuState {
  userId: string;
  x: number;
  y: number;
}

const CONTEXT_MENU_WIDTH = 230;
const CONTEXT_MENU_HEIGHT = 220;

const clampMenuPoint = (x: number, y: number) => {
  if (typeof window === "undefined") return { x, y };
  return {
    x: Math.max(8, Math.min(x, window.innerWidth - CONTEXT_MENU_WIDTH)),
    y: Math.max(8, Math.min(y, window.innerHeight - CONTEXT_MENU_HEIGHT))
  };
};

const copyToClipboard = async (value: string) => {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;
  await navigator.clipboard.writeText(value);
};

export const MemberList = ({ users }: MemberListProps) => {
  const [contextMenu, setContextMenu] = useState<MemberContextMenuState | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenu(null);
        setProfileUserId(null);
      }
    };
    const handleResize = () => {
      setContextMenu(null);
      setProfileUserId(null);
    };
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const openContextMenu = (event: ReactMouseEvent, userId: string) => {
    event.preventDefault();
    const point = clampMenuPoint(event.clientX, event.clientY);
    setContextMenu({ userId, x: point.x, y: point.y });
  };

  const runContextAction = (handler: () => Promise<void> | void) => {
    setContextMenu(null);
    void Promise.resolve(handler()).catch(() => undefined);
  };

  const contextUser = contextMenu ? userById.get(contextMenu.userId) : undefined;
  const profileUser = profileUserId ? userById.get(profileUserId) : undefined;

  return (
    <aside className="member-list">
      <div className="member-list-header">
        <h3>Members</h3>
        <span>{users.length}</span>
      </div>
      <div className="member-scroll">
        {users.map((user) => (
          <button
            key={user.id}
            type="button"
            className="member"
            onContextMenu={(event) => openContextMenu(event, user.id)}
            onClick={() => setProfileUserId(user.id)}
          >
            <div className={`avatar ${user.status}`}>
              {user.avatarUrl ? <img src={user.avatarUrl} alt={`${user.name} avatar`} /> : user.avatar}
            </div>
            <div className="member-meta">
              <p className="member-name" style={user.roleColor ? { color: user.roleColor } : undefined}>
                {user.name}
              </p>
              <div className="roles">
                {user.roles.map((role) => (
                  <span key={role} className="role">
                    {role}
                  </span>
                ))}
              </div>
            </div>
            <span className={`status ${user.status}`}>{user.status}</span>
          </button>
        ))}
      </div>

      {contextMenu && contextUser && (
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
            <button onClick={() => runContextAction(() => copyToClipboard(`@${contextUser.name}`))}>
              Copy @mention
            </button>
            <button onClick={() => runContextAction(() => copyToClipboard(contextUser.id))}>Copy user ID</button>
            <button onClick={() => runContextAction(() => copyToClipboard(contextUser.name))}>
              Copy display name
            </button>
            <button
              onClick={() =>
                runContextAction(() =>
                  copyToClipboard(contextUser.roles.length ? contextUser.roles.join(", ") : "member")
                )
              }
            >
              Copy roles
            </button>
          </div>
        </div>
      )}

      {profileUser && (
        <div
          className="member-profile-layer"
          onMouseDown={() => setProfileUserId(null)}
          onContextMenu={(event) => event.preventDefault()}
        >
          <section className="member-profile-card" onMouseDown={(event) => event.stopPropagation()}>
            <div className="member-profile-banner" />
            <div className="member-profile-header">
              <div className={`avatar ${profileUser.status} member-profile-avatar`}>
                {profileUser.avatarUrl ? (
                  <img src={profileUser.avatarUrl} alt={`${profileUser.name} avatar`} />
                ) : (
                  profileUser.avatar
                )}
              </div>
              <div>
                <h4
                  className="member-profile-name"
                  style={profileUser.roleColor ? { color: profileUser.roleColor } : undefined}
                >
                  {profileUser.name}
                </h4>
                <p className="member-profile-id">{profileUser.id}</p>
              </div>
            </div>
            <p className={`member-profile-status ${profileUser.status}`}>{profileUser.status}</p>
            <div className="member-profile-roles">
              <p className="eyebrow">Roles</p>
              <div className="roles">
                {profileUser.roles.map((role) => (
                  <span key={`${profileUser.id}-${role}`} className="role">
                    {role}
                  </span>
                ))}
              </div>
            </div>
            <button className="pill ghost" onClick={() => setProfileUserId(null)}>
              Close
            </button>
          </section>
        </div>
      )}
    </aside>
  );
};
