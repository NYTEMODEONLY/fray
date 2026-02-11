import { Message, User } from "../types";
import { renderMarkdown } from "../utils/markdown";
import { MessageComposer } from "./MessageComposer";
import { ArrowUpToLine, X } from "lucide-react";

interface ThreadPanelProps {
  rootMessage: Message | undefined;
  threadMessages: Message[];
  users: User[];
  unreadReplies: number;
  onJumpToRoot: () => void;
  onSend: (body: string) => void;
  enterToSend: boolean;
  composerSpellcheck?: boolean;
  onClose: () => void;
}

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export const ThreadPanel = ({
  rootMessage,
  threadMessages,
  users,
  unreadReplies,
  onJumpToRoot,
  onSend,
  enterToSend,
  composerSpellcheck,
  onClose
}: ThreadPanelProps) => {
  const userMap = new Map(users.map((user) => [user.id, user]));

  return (
    <aside className="thread-panel">
      <div className="thread-header">
        <div>
          <p className="eyebrow">Thread</p>
          <h3>{rootMessage ? `On ${rootMessage.id.slice(0, 4)}` : "Thread"}</h3>
          {unreadReplies > 0 && <p className="thread-unread-pill">{unreadReplies} new replies</p>}
        </div>
        <div className="thread-header-actions">
          <button className="icon-button" aria-label="Jump to root" onClick={onJumpToRoot}>
            <ArrowUpToLine size={14} aria-hidden="true" />
          </button>
          <button className="icon-button" aria-label="Close thread" onClick={onClose}>
            <X size={14} aria-hidden="true" />
          </button>
        </div>
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
        enterToSend={enterToSend}
        spellCheckEnabled={composerSpellcheck}
        placeholder="Reply in thread"
      />
    </aside>
  );
};
