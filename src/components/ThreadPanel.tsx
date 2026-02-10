import { Message, User } from "../types";
import { renderMarkdown } from "../utils/markdown";
import { MessageComposer } from "./MessageComposer";

interface ThreadPanelProps {
  rootMessage: Message | undefined;
  threadMessages: Message[];
  users: User[];
  onSend: (body: string) => void;
  onClose: () => void;
}

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export const ThreadPanel = ({ rootMessage, threadMessages, users, onSend, onClose }: ThreadPanelProps) => {
  const userMap = new Map(users.map((user) => [user.id, user]));

  return (
    <aside className="thread-panel">
      <div className="thread-header">
        <div>
          <p className="eyebrow">Thread</p>
          <h3>{rootMessage ? `On ${rootMessage.id.slice(0, 4)}` : "Thread"}</h3>
        </div>
        <button className="icon-button" onClick={onClose}>
          ✕
        </button>
      </div>

      {rootMessage && (
        <div className="thread-root">
          <p className="thread-author">{userMap.get(rootMessage.authorId)?.name}</p>
          <div
            className="message-text"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(rootMessage.body) }}
          />
        </div>
      )}

      <div className="thread-messages">
        {threadMessages.map((message) => (
          <div key={message.id} className="thread-message">
            <div className="thread-meta">
              <span>{userMap.get(message.authorId)?.name}</span>
              <span>{formatTime(message.timestamp)}</span>
            </div>
            <div
              className="message-text"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(message.body) }}
            />
          </div>
        ))}
      </div>

      <MessageComposer
        replyToId={null}
        onClearReply={() => undefined}
        onSend={(payload) => onSend(payload.body)}
        placeholder="Reply in thread"
      />
    </aside>
  );
};
