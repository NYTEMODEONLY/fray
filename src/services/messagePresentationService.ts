import { Message } from "../types";

export const ROOM_SEARCH_FILTERS = ["all", "mentions", "has_links", "from_me"] as const;

export type RoomSearchFilter = (typeof ROOM_SEARCH_FILTERS)[number];

interface BuildSearchResultIdsOptions {
  query: string;
  filter: RoomSearchFilter;
  meId: string;
  meName: string;
}

export interface ThreadSummary {
  totalReplies: number;
  unreadReplies: number;
}

const containsSearchText = (message: Message, query: string) => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return message.body.toLowerCase().includes(needle);
};

export const messageContainsLink = (message: Message) =>
  /https?:\/\/|www\./i.test(message.body);

export const messageMentionsUser = (message: Message, meId: string, meName: string) => {
  const body = message.body.toLowerCase();
  const mentionByName = meName ? body.includes(`@${meName.toLowerCase()}`) : false;
  const mentionById = meId ? body.includes(`@${meId.toLowerCase()}`) : false;
  return mentionByName || mentionById;
};

const matchesFilter = (
  message: Message,
  filter: RoomSearchFilter,
  meId: string,
  meName: string
) => {
  if (filter === "mentions") return messageMentionsUser(message, meId, meName);
  if (filter === "has_links") return messageContainsLink(message);
  if (filter === "from_me") return message.authorId === meId;
  return true;
};

export const buildSearchResultIds = (
  messages: Message[],
  options: BuildSearchResultIdsOptions
) => {
  const { query, filter, meId, meName } = options;
  if (!query.trim() && filter === "all") {
    return [];
  }
  return messages
    .filter((message) => containsSearchText(message, query))
    .filter((message) => matchesFilter(message, filter, meId, meName))
    .map((message) => message.id);
};

export const buildThreadSummaries = (
  allMessages: Message[],
  roomLastReadTs: number,
  threadLastViewedByRootId: Record<string, number> | undefined
) => {
  const summaryByRootId: Record<string, ThreadSummary> = {};

  allMessages
    .filter((message) => !message.threadRootId)
    .forEach((message) => {
      summaryByRootId[message.id] = { totalReplies: 0, unreadReplies: 0 };
    });

  allMessages
    .filter((message): message is Message & { threadRootId: string } => Boolean(message.threadRootId))
    .forEach((message) => {
      const rootId = message.threadRootId;
      const summary = summaryByRootId[rootId] ?? { totalReplies: 0, unreadReplies: 0 };
      const baseline = threadLastViewedByRootId?.[rootId] ?? roomLastReadTs;
      summary.totalReplies += 1;
      if (message.timestamp > baseline) {
        summary.unreadReplies += 1;
      }
      summaryByRootId[rootId] = summary;
    });

  return summaryByRootId;
};
