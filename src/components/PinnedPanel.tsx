import { Message, User } from "../types";
import { renderMarkdown } from "../utils/markdown";
import { X } from "lucide-react";

interface PinnedPanelProps {
  pinned: Message[];
  users: User[];
  onJump: (messageId: string) => void;
  onClose: () => void;
}

export const PinnedPanel = ({ pinned, users, onJump, onClose }: PinnedPanelProps) => {
  const userMap = new Map(users.map((user) => [user.id, user]));

  return (
    <aside className="pinned-panel">
      <div className="thread-header">
        <div>
          <p className="eyebrow">Pins</p>
          <h3>Saved messages</h3>
        </div>
        <button className="icon-button" aria-label="Close pins" onClick={onClose}>
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="pinned-list">
        {pinned.length === 0 && <p className="empty">No pinned messages yet.</p>}
        {pinned.map((message) => (
          <div key={message.id} className="pinned-item">
            <p className="pinned-author">{userMap.get(message.authorId)?.name}</p>
            <div
              className="message-text"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(message.body) }}
            />
            <button className="pill" onClick={() => onJump(message.id)}>Jump</button>
          </div>
        ))}
      </div>
    </aside>
  );
};
