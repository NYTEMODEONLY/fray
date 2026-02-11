import { useEffect, useMemo, useRef, useState } from "react";
import { Message, User } from "../types";
import { PermissionSnapshot } from "../services/permissionService";
import { renderMarkdown } from "../utils/markdown";
import { MoreHorizontal, SmilePlus } from "lucide-react";
import {
  messageMentionsUser,
  RoomSearchFilter,
  ThreadSummary
} from "../services/messagePresentationService";

interface MessageListProps {
  messages: Message[];
  users: User[];
  meId: string;
  meName: string;
  messageDensity: "cozy" | "compact";
  permissionSnapshot: PermissionSnapshot;
  onReact: (messageId: string, emoji: string) => void;
  onReply: (messageId: string) => void;
  onQuickReply: (messageId: string) => void;
  onThread: (messageId: string) => void;
  onPin: (messageId: string) => void;
  onRedact: (messageId: string) => void;
  onCopyLink: (messageId: string) => void;
  canRedactMessage: (authorId: string) => boolean;
  onLoadOlder: () => Promise<void>;
  isLoadingHistory: boolean;
  canLoadMoreHistory: boolean;
  searchQuery: string;
  searchFilter: RoomSearchFilter;
  searchResultIds: string[];
  activeSearchResultId: string | null;
  focusMessageId: string | null;
  onFocusHandled: () => void;
  threadSummaryByRootId: Record<string, ThreadSummary>;
  unreadCount: number;
  roomLastReadTs: number;
  onJumpToLatest: () => void;
}

const THREAD_GROUP_WINDOW_MS = 5 * 60 * 1000;
const EMOJI_OPTIONS = ["👍", "❤️", "😂", "🔥", "🎉", "👀", "✅", "❌"];

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const formatDate = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric"
  });

const isSameDay = (left: number, right: number) => {
  const leftDate = new Date(left);
  const rightDate = new Date(right);
  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
};

export const MessageList = ({
  messages,
  users,
  meId,
  meName,
  messageDensity,
  permissionSnapshot,
  onReact,
  onReply,
  onQuickReply,
  onThread,
  onPin,
  onRedact,
  onCopyLink,
  canRedactMessage,
  onLoadOlder,
  isLoadingHistory,
  canLoadMoreHistory,
  searchQuery,
  searchFilter,
  searchResultIds,
  activeSearchResultId,
  focusMessageId,
  onFocusHandled,
  threadSummaryByRootId,
  unreadCount,
  roomLastReadTs,
  onJumpToLatest
}: MessageListProps) => {
  const listRef = useRef<HTMLDivElement | null>(null);
  const wasLoadingRef = useRef(false);
  const scrollRestoreRef = useRef<{ previousHeight: number; previousTop: number } | null>(null);
  const messageNodeMapRef = useRef<Record<string, HTMLElement | null>>({});
  const [actionsOpenFor, setActionsOpenFor] = useState<string | null>(null);
  const [emojiPickerFor, setEmojiPickerFor] = useState<string | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const userMap = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const searchResultSet = useMemo(() => new Set(searchResultIds), [searchResultIds]);
  const unreadSeparatorIndex = useMemo(() => {
    if (unreadCount <= 0 || !messages.length) return -1;
    const byTimestampIndex = messages.findIndex((message) => message.timestamp > roomLastReadTs);
    if (byTimestampIndex >= 0) {
      return byTimestampIndex;
    }
    return Math.max(messages.length - unreadCount, 0);
  }, [messages, unreadCount, roomLastReadTs]);

  const presentationRows = useMemo(
    () =>
      messages.map((message, index) => {
        const previous = index > 0 ? messages[index - 1] : undefined;
        const groupedWithPrevious =
          Boolean(previous) &&
          previous?.authorId === message.authorId &&
          isSameDay(previous.timestamp, message.timestamp) &&
          message.timestamp - previous.timestamp < THREAD_GROUP_WINDOW_MS;
        const showDaySeparator = !previous || !isSameDay(previous.timestamp, message.timestamp);
        const showUnreadSeparator = unreadSeparatorIndex === index;
        return {
          message,
          groupedWithPrevious,
          showDaySeparator,
          showUnreadSeparator
        };
      }),
    [messages, unreadSeparatorIndex]
  );

  const handleScroll = () => {
    const list = listRef.current;
    if (!list) return;

    const distanceFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
    setIsNearBottom(distanceFromBottom < 84);

    if (list.scrollTop > 96) return;
    if (!canLoadMoreHistory || isLoadingHistory) return;

    scrollRestoreRef.current = {
      previousHeight: list.scrollHeight,
      previousTop: list.scrollTop
    };
    onLoadOlder().catch(() => undefined);
  };

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const distanceFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
    setIsNearBottom(distanceFromBottom < 84);
  }, [messages.length]);

  useEffect(() => {
    const list = listRef.current;
    if (wasLoadingRef.current && !isLoadingHistory && scrollRestoreRef.current && list) {
      const delta = list.scrollHeight - scrollRestoreRef.current.previousHeight;
      list.scrollTop = scrollRestoreRef.current.previousTop + Math.max(delta, 0);
      scrollRestoreRef.current = null;
    }

    wasLoadingRef.current = isLoadingHistory;
  }, [isLoadingHistory, messages.length]);

  useEffect(() => {
    const targetId = focusMessageId ?? activeSearchResultId;
    if (!targetId) return;
    const target = messageNodeMapRef.current[targetId];
    if (!target) return;
    if (typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    target.classList.add("focus-pulse");
    const timeoutId = window.setTimeout(() => {
      target.classList.remove("focus-pulse");
    }, 900);
    onFocusHandled();
    return () => window.clearTimeout(timeoutId);
  }, [focusMessageId, activeSearchResultId, onFocusHandled]);

  const runAction = (handler: () => void) => {
    handler();
    setActionsOpenFor(null);
    setEmojiPickerFor(null);
  };

  return (
    <div
      ref={listRef}
      className={messageDensity === "compact" ? "message-list compact" : "message-list"}
      onScroll={handleScroll}
    >
      {isLoadingHistory && (
        <div className="message-history-status">Loading older messages...</div>
      )}
      {!isLoadingHistory && !canLoadMoreHistory && (
        <div className="message-history-status">Beginning of conversation</div>
      )}
      {searchQuery.trim() && (
        <div className="message-history-status">
          Search: <strong>{searchFilter.replace("_", " ")}</strong> ({searchResultIds.length} results)
        </div>
      )}
      {presentationRows.map(({ message, groupedWithPrevious, showDaySeparator, showUnreadSeparator }) => {
        const author = userMap.get(message.authorId);
        const canRedact = canRedactMessage(message.authorId);
        const canCopyLink = permissionSnapshot.membership === "join";
        const threadSummary = threadSummaryByRootId[message.id];
        const hasThreadReplies = (threadSummary?.totalReplies ?? 0) > 0;
        const mentionHit =
          message.authorId !== meId && messageMentionsUser(message, meId, meName);
        const searchHit = searchResultSet.has(message.id);
        const isActiveSearchHit = activeSearchResultId === message.id;
        const articleClasses = [
          "message",
          groupedWithPrevious ? "grouped" : "",
          mentionHit ? "mention-hit" : "",
          searchHit ? "search-hit" : "",
          isActiveSearchHit ? "search-active" : "",
          actionsOpenFor === message.id ? "actions-open" : ""
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <div key={message.id}>
            {showDaySeparator && (
              <div className="message-day-separator">
                <span>{formatDate(message.timestamp)}</span>
              </div>
            )}
            {showUnreadSeparator && (
              <div className="message-unread-separator">
                <span>New</span>
              </div>
            )}
            <article
              ref={(node) => {
                messageNodeMapRef.current[message.id] = node;
              }}
              className={articleClasses}
            >
              <div className={author?.id === meId ? "avatar me" : "avatar"}>
                {groupedWithPrevious || messageDensity === "compact" ? (
                  ""
                ) : author?.avatarUrl ? (
                  <img src={author.avatarUrl} alt={`${author.name} avatar`} />
                ) : (
                  author?.avatar ?? "?"
                )}
              </div>
              <div className="message-body">
                {(!groupedWithPrevious || messageDensity === "compact") ? (
                  <div className="message-meta">
                    <span className="message-author">{author?.name ?? "Unknown"}</span>
                    <span className="message-time" title={new Date(message.timestamp).toLocaleString()}>
                      {formatTime(message.timestamp)}
                    </span>
                    {message.status === "queued" && <span className="message-queued">queued</span>}
                    {message.pinned && <span className="message-pinned">pinned</span>}
                    <button
                      className="message-more"
                      aria-label="Message actions"
                      aria-expanded={actionsOpenFor === message.id}
                      onClick={() =>
                        setActionsOpenFor((current) => (current === message.id ? null : message.id))
                      }
                    >
                      <MoreHorizontal size={14} aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <div className="message-sub-meta">
                    <span>{formatTime(message.timestamp)}</span>
                    <button
                      className="message-more"
                      aria-label="Message actions"
                      aria-expanded={actionsOpenFor === message.id}
                      onClick={() =>
                        setActionsOpenFor((current) => (current === message.id ? null : message.id))
                      }
                    >
                      <MoreHorizontal size={14} aria-hidden="true" />
                    </button>
                  </div>
                )}

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
                  {permissionSnapshot.actions.react && (
                    <div className="message-emoji-picker-wrap">
                      <button
                        aria-label="Add reaction"
                        onClick={() =>
                          setEmojiPickerFor((current) => (current === message.id ? null : message.id))
                        }
                      >
                        <SmilePlus size={13} aria-hidden="true" />
                      </button>
                      {emojiPickerFor === message.id && (
                        <div className="message-emoji-picker">
                          {EMOJI_OPTIONS.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => runAction(() => onReact(message.id, emoji))}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {permissionSnapshot.actions.send && (
                    <>
                      <button onClick={() => runAction(() => onReply(message.id))}>Reply</button>
                      <button onClick={() => runAction(() => onQuickReply(message.id))}>Quick Reply</button>
                      <button onClick={() => runAction(() => onThread(message.id))}>Thread</button>
                    </>
                  )}
                  {permissionSnapshot.actions.pin && (
                    <button onClick={() => runAction(() => onPin(message.id))}>
                      {message.pinned ? "Unpin" : "Pin"}
                    </button>
                  )}
                  {canCopyLink && (
                    <button onClick={() => runAction(() => onCopyLink(message.id))}>Copy Link</button>
                  )}
                  {canRedact && (
                    <button onClick={() => runAction(() => onRedact(message.id))}>Delete</button>
                  )}
                </div>

                {hasThreadReplies && (
                  <button className="message-thread-indicator" onClick={() => onThread(message.id)}>
                    {threadSummary.totalReplies} repl{threadSummary.totalReplies === 1 ? "y" : "ies"}
                    {threadSummary.unreadReplies > 0 ? ` · ${threadSummary.unreadReplies} new` : ""}
                  </button>
                )}

                {message.reactions.length > 0 && (
                  <div className="message-reactions">
                    {message.reactions.map((reaction) => (
                      <button
                        key={reaction.emoji}
                        className={reaction.userIds.includes(meId) ? "reaction active" : "reaction"}
                        onClick={() => {
                          if (!permissionSnapshot.actions.react) return;
                          onReact(message.id, reaction.emoji);
                        }}
                        disabled={!permissionSnapshot.actions.react}
                      >
                        {reaction.emoji} {reaction.userIds.length}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </article>
          </div>
        );
      })}

      {unreadCount > 0 && !isNearBottom && (
        <button className="jump-to-latest" onClick={onJumpToLatest}>
          Jump to latest ({unreadCount})
        </button>
      )}
    </div>
  );
};
