import { useMemo } from "react";
import { Message, User } from "../types";
import { renderMarkdown } from "../utils/markdown";

interface MessageListProps {
  messages: Message[];
  users: User[];
  meId: string;
  onReact: (messageId: string, emoji: string) => void;
  onReply: (messageId: string) => void;
  onThread: (messageId: string) => void;
  onPin: (messageId: string) => void;
  searchQuery: string;
}

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export const MessageList = ({
  messages,
  users,
  meId,
  onReact,
  onReply,
  onThread,
  onPin,
  searchQuery
}: MessageListProps) => {
  const userMap = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const filtered = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return messages;
    return messages.filter((message) => message.body.toLowerCase().includes(needle));
  }, [messages, searchQuery]);

  return (
    <div className="message-list">
      {filtered.map((message) => {
        const author = userMap.get(message.authorId);
        return (
          <article key={message.id} className="message">
            <div className={author?.id === meId ? "avatar me" : "avatar"}>
              {author?.avatar ?? "?"}
            </div>
            <div className="message-body">
              <div className="message-meta">
                <span className="message-author">{author?.name ?? "Unknown"}</span>
                <span className="message-time">{formatTime(message.timestamp)}</span>
                {message.status === "queued" && <span className="message-queued">queued</span>}
                {message.pinned && <span className="message-pinned">pinned</span>}
              </div>

              {message.replyToId && (
                <div className="message-reply">Replying to #{message.replyToId.slice(0, 4)}</div>
              )}

              <div
                className="message-text"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(message.body) }}
              />

              {message.attachments && (
                <div className="message-attachments">
                  {message.attachments.map((file) => (
                    <div key={file.id} className="attachment">
                      {file.type === "image" ? (
                        file.url ? (
                          <img src={file.url} alt={file.name} />
                        ) : (
                          <div className="file-icon">IMG</div>
                        )
                      ) : (
                        <div className="file-icon">FILE</div>
                      )}
                      <div>
                        <p>{file.name}</p>
                        <span>{Math.round(file.size / 1024)}kb</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="message-actions">
                <button onClick={() => onReact(message.id, "🔥")}>🔥</button>
                <button onClick={() => onReact(message.id, "✅")}>✅</button>
                <button onClick={() => onReply(message.id)}>Reply</button>
                <button onClick={() => onThread(message.id)}>Thread</button>
                <button onClick={() => onPin(message.id)}>{message.pinned ? "Unpin" : "Pin"}</button>
              </div>

              {message.reactions.length > 0 && (
                <div className="message-reactions">
                  {message.reactions.map((reaction) => (
                    <button
                      key={reaction.emoji}
                      className={reaction.userIds.includes(meId) ? "reaction active" : "reaction"}
                      onClick={() => onReact(message.id, reaction.emoji)}
                    >
                      {reaction.emoji} {reaction.userIds.length}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
};
