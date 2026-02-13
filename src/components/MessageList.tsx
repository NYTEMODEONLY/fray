import {
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { Message, User } from "../types";
import { PermissionSnapshot } from "../services/permissionService";
import { renderMarkdown } from "../utils/markdown";
import {
  CornerUpLeft,
  Link2,
  MessageCircle,
  MoreHorizontal,
  Pin,
  Send,
  SmilePlus,
  Trash2
} from "lucide-react";
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
  onOpenMessageLink?: (href: string) => boolean;
}

const THREAD_GROUP_WINDOW_MS = 5 * 60 * 1000;
const EMOJI_OPTIONS = ["👍", "❤️", "😂", "🔥", "🎉", "👀", "✅", "❌"];
const CONTEXT_MENU_WIDTH = 220;
const CONTEXT_MENU_HEIGHT = 260;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const isSameDay = (left: number, right: number) => {
  const leftDate = new Date(left);
  const rightDate = new Date(right);
  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
};

const isYesterday = (timestamp: number, nowTimestamp: number) => {
  const yesterday = new Date(nowTimestamp);
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameDay(timestamp, yesterday.getTime());
};

const formatRelativeAge = (timestamp: number, nowTimestamp: number) => {
  const delta = Math.max(nowTimestamp - timestamp, 0);
  if (delta < MINUTE_MS) return "just now";
  if (delta < HOUR_MS) return `${Math.max(1, Math.floor(delta / MINUTE_MS))}m ago`;
  if (delta < DAY_MS) return `${Math.floor(delta / HOUR_MS)}h ago`;
  if (delta < 7 * DAY_MS) return `${Math.floor(delta / DAY_MS)}d ago`;
  return new Date(timestamp).toLocaleDateString([], { month: "short", day: "numeric" });
};

const formatMetaTimestamp = (timestamp: number, nowTimestamp: number) => {
  const time = formatTime(timestamp);
  if (isSameDay(timestamp, nowTimestamp)) return `Today at ${time}`;
  if (isYesterday(timestamp, nowTimestamp)) return `Yesterday at ${time}`;
  const target = new Date(timestamp);
  const now = new Date(nowTimestamp);
  const sameYear = target.getFullYear() === now.getFullYear();
  const dateLabel = target.toLocaleDateString([], sameYear
    ? { weekday: "short", month: "short", day: "numeric" }
    : { weekday: "short", month: "short", day: "numeric", year: "numeric" }
  );
  return `${dateLabel} at ${time}`;
};

const formatDaySeparator = (timestamp: number, nowTimestamp: number) => {
  if (isSameDay(timestamp, nowTimestamp)) return "Today";
  if (isYesterday(timestamp, nowTimestamp)) return "Yesterday";
  return new Date(timestamp).toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
};

const clampMenuPoint = (x: number, y: number) => {
  if (typeof window === "undefined") return { x, y };
  return {
    x: Math.max(8, Math.min(x, window.innerWidth - CONTEXT_MENU_WIDTH)),
    y: Math.max(8, Math.min(y, window.innerHeight - CONTEXT_MENU_HEIGHT))
  };
};

const shouldShowOverflowActionTrigger = () => {
  if (typeof window === "undefined") return true;
  if (typeof window.matchMedia !== "function") return true;
  return !window.matchMedia("(hover: hover) and (pointer: fine)").matches;
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
  onJumpToLatest,
  onOpenMessageLink
}: MessageListProps) => {
  const listRef = useRef<HTMLDivElement | null>(null);
  const wasLoadingRef = useRef(false);
  const scrollRestoreRef = useRef<{ previousHeight: number; previousTop: number } | null>(null);
  const messageNodeMapRef = useRef<Record<string, HTMLElement | null>>({});
  const [actionsOpenFor, setActionsOpenFor] = useState<string | null>(null);
  const [emojiPickerFor, setEmojiPickerFor] = useState<string | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [contextMenu, setContextMenu] = useState<{ messageId: string; x: number; y: number } | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [showOverflowActionTrigger, setShowOverflowActionTrigger] = useState(
    () => shouldShowOverflowActionTrigger()
  );
  const userMap = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const messageMap = useMemo(() => new Map(messages.map((message) => [message.id, message])), [messages]);
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

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowTs(Date.now()), MINUTE_MS);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (typeof window.matchMedia !== "function") return undefined;
    const hoverMedia = window.matchMedia("(hover: hover) and (pointer: fine)");
    const syncTriggerVisibility = () => {
      setShowOverflowActionTrigger(!hoverMedia.matches);
    };
    syncTriggerVisibility();
    if (typeof hoverMedia.addEventListener === "function") {
      hoverMedia.addEventListener("change", syncTriggerVisibility);
      return () => hoverMedia.removeEventListener("change", syncTriggerVisibility);
    }
    hoverMedia.addListener(syncTriggerVisibility);
    return () => hoverMedia.removeListener(syncTriggerVisibility);
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setActionsOpenFor(null);
      setEmojiPickerFor(null);
      setContextMenu(null);
    };
    const handleResize = () => setContextMenu(null);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

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

  const runAction = (handler: () => void | Promise<void>) => {
    void Promise.resolve(handler()).catch(() => undefined);
    setActionsOpenFor(null);
    setEmojiPickerFor(null);
    setContextMenu(null);
  };

  const handleMessageTextClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!onOpenMessageLink) return;
    const target = event.target as HTMLElement | null;
    const anchor = target?.closest("a");
    if (!anchor) return;
    const href = (anchor as HTMLAnchorElement).href;
    if (!href) return;
    const handled = onOpenMessageLink(href);
    if (handled) {
      event.preventDefault();
    }
  };

  const openMessageContextMenu = (event: ReactMouseEvent, messageId: string) => {
    event.preventDefault();
    const point = clampMenuPoint(event.clientX, event.clientY);
    setContextMenu({ messageId, x: point.x, y: point.y });
  };

  const contextMessage = contextMenu ? messageMap.get(contextMenu.messageId) : undefined;
  const canContextCopyLink = permissionSnapshot.membership === "join";
  const canContextRedact = contextMessage ? canRedactMessage(contextMessage.authorId) : false;

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
        const isSystemMessage = message.system === true;
        const canRedact = canRedactMessage(message.authorId);
        const canCopyLink = permissionSnapshot.membership === "join";
        const threadSummary = threadSummaryByRootId[message.id];
        const hasThreadReplies = (threadSummary?.totalReplies ?? 0) > 0;
        const mentionHit =
          !isSystemMessage && message.authorId !== meId && messageMentionsUser(message, meId, meName);
        const searchHit = searchResultSet.has(message.id);
        const isActiveSearchHit = activeSearchResultId === message.id;
        const articleClasses = [
          "message",
          isSystemMessage ? "system" : "",
          groupedWithPrevious ? "grouped" : "",
          mentionHit ? "mention-hit" : "",
          searchHit ? "search-hit" : "",
          isActiveSearchHit ? "search-active" : "",
          actionsOpenFor === message.id ? "actions-open" : ""
        ]
          .filter(Boolean)
          .join(" ");
        const absoluteMeta = formatMetaTimestamp(message.timestamp, nowTs);
        const relativeMeta = formatRelativeAge(message.timestamp, nowTs);

        return (
          <div key={message.id}>
            {showDaySeparator && (
              <div className="message-day-separator">
                <span>{formatDaySeparator(message.timestamp, nowTs)}</span>
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
              onContextMenu={(event) => {
                if (isSystemMessage) return;
                openMessageContextMenu(event, message.id);
              }}
            >
              <div className={author?.id === meId ? "avatar me" : isSystemMessage ? "avatar system" : "avatar"}>
                {groupedWithPrevious || messageDensity === "compact" ? (
                  ""
                ) : author?.avatarUrl ? (
                  <img src={author.avatarUrl} alt={`${author.name} avatar`} />
                ) : isSystemMessage ? (
                  "•"
                ) : (
                  author?.avatar ?? "?"
                )}
              </div>
              <div className="message-body">
                {(!groupedWithPrevious || messageDensity === "compact") ? (
                  <div className="message-meta">
                    <span
                      className="message-author"
                      style={isSystemMessage ? undefined : author?.roleColor ? { color: author.roleColor } : undefined}
                    >
                      {isSystemMessage ? "System" : author?.name ?? "Unknown"}
                    </span>
                    <span className="message-time" title={new Date(message.timestamp).toLocaleString()}>
                      {absoluteMeta}
                    </span>
                    <span className="message-time-relative">{relativeMeta}</span>
                    {message.status === "queued" && <span className="message-queued">queued</span>}
                    {message.pinned && <span className="message-pinned">pinned</span>}
                    {!isSystemMessage && showOverflowActionTrigger && (
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
                    )}
                  </div>
                ) : (
                  <div className="message-sub-meta">
                    <span title={absoluteMeta}>{formatTime(message.timestamp)}</span>
                    <span className="message-time-relative">{relativeMeta}</span>
                    {!isSystemMessage && showOverflowActionTrigger && (
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
                    )}
                  </div>
                )}

                {!isSystemMessage && (
                  <div className="message-toolbar" role="toolbar" aria-label="Message actions">
                    {permissionSnapshot.actions.react && (
                      <div className="message-emoji-picker-wrap">
                        <button
                          className="toolbar-button"
                          aria-label="Add reaction"
                          onClick={() =>
                            setEmojiPickerFor((current) => (current === message.id ? null : message.id))
                          }
                        >
                          <SmilePlus size={14} aria-hidden="true" />
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
                        <button className="toolbar-button" aria-label="Reply" onClick={() => runAction(() => onReply(message.id))}>
                          <CornerUpLeft size={14} aria-hidden="true" />
                        </button>
                        <button
                          className="toolbar-button"
                          aria-label="Quick Reply"
                          onClick={() => runAction(() => onQuickReply(message.id))}
                        >
                          <Send size={14} aria-hidden="true" />
                        </button>
                        <button className="toolbar-button" aria-label="Thread" onClick={() => runAction(() => onThread(message.id))}>
                          <MessageCircle size={14} aria-hidden="true" />
                        </button>
                      </>
                    )}
                    {permissionSnapshot.actions.pin && (
                      <button
                        className="toolbar-button"
                        aria-label={message.pinned ? "Unpin" : "Pin"}
                        onClick={() => runAction(() => onPin(message.id))}
                      >
                        <Pin size={14} aria-hidden="true" />
                      </button>
                    )}
                    {canCopyLink && (
                      <button className="toolbar-button" aria-label="Copy Link" onClick={() => runAction(() => onCopyLink(message.id))}>
                        <Link2 size={14} aria-hidden="true" />
                      </button>
                    )}
                    {canRedact && (
                      <button className="toolbar-button danger" aria-label="Delete" onClick={() => runAction(() => onRedact(message.id))}>
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )}

                {!isSystemMessage && message.replyToId && (
                  <div className="message-reply">
                    {(() => {
                      const replyTarget = messageMap.get(message.replyToId ?? "");
                      if (!replyTarget) {
                        return `Replying to #${message.replyToId.slice(0, 4)}`;
                      }
                      const replyAuthor = userMap.get(replyTarget.authorId)?.name ?? "Unknown";
                      const trimmed = replyTarget.body.trim();
                      const preview = trimmed.length > 56 ? `${trimmed.slice(0, 56)}...` : trimmed;
                      return `Replying to ${replyAuthor}: ${preview || "(empty message)"}`;
                    })()}
                  </div>
                )}

                <div
                  className="message-text"
                  onClick={handleMessageTextClick}
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

                {!isSystemMessage && hasThreadReplies && (
                  <button className="message-thread-indicator" onClick={() => onThread(message.id)}>
                    {threadSummary.totalReplies} repl{threadSummary.totalReplies === 1 ? "y" : "ies"}
                    {threadSummary.unreadReplies > 0 ? ` · ${threadSummary.unreadReplies} new` : ""}
                  </button>
                )}

                {!isSystemMessage && message.reactions.length > 0 && (
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

      {contextMenu && contextMessage && (
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
            {permissionSnapshot.actions.send && (
              <>
                <button onClick={() => runAction(() => onReply(contextMessage.id))}>Reply</button>
                <button onClick={() => runAction(() => onQuickReply(contextMessage.id))}>Quick Reply</button>
                <button onClick={() => runAction(() => onThread(contextMessage.id))}>Thread</button>
              </>
            )}
            {permissionSnapshot.actions.react && (
              <button onClick={() => runAction(() => onReact(contextMessage.id, "👍"))}>
                React with 👍
              </button>
            )}
            {permissionSnapshot.actions.pin && (
              <button onClick={() => runAction(() => onPin(contextMessage.id))}>
                {contextMessage.pinned ? "Unpin" : "Pin"}
              </button>
            )}
            {canContextCopyLink && (
              <button onClick={() => runAction(() => onCopyLink(contextMessage.id))}>Copy Link</button>
            )}
            {canContextRedact && (
              <button className="danger" onClick={() => runAction(() => onRedact(contextMessage.id))}>
                Delete
              </button>
            )}
            <div className="context-menu-separator" />
            <button onClick={() => runAction(() => navigator.clipboard?.writeText(contextMessage.id))}>
              Copy message ID
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
