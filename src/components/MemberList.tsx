import { User } from "../types";

interface MemberListProps {
  users: User[];
}

export const MemberList = ({ users }: MemberListProps) => (
  <aside className="member-list">
    <div className="member-list-header">
      <h3>Members</h3>
      <span>{users.length}</span>
    </div>
    <div className="member-scroll">
      {users.map((user) => (
        <div key={user.id} className="member">
          <div className={`avatar ${user.status}`}>
            {user.avatarUrl ? <img src={user.avatarUrl} alt={`${user.name} avatar`} /> : user.avatar}
          </div>
          <div className="member-meta">
            <p>{user.name}</p>
            <div className="roles">
              {user.roles.map((role) => (
                <span key={role} className="role">
                  {role}
                </span>
              ))}
            </div>
          </div>
          <span className={`status ${user.status}`}>{user.status}</span>
        </div>
      ))}
    </div>
  </aside>
);
