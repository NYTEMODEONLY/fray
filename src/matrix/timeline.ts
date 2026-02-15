import { EventType, type MatrixClient, type MatrixEvent, type MatrixRoom } from "./client";
import type { Attachment, Message } from "../types";

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

export const mapEventsToMessages = (client: MatrixClient, room: MatrixRoom): Message[] => {
  const timelineEvents = room.getLiveTimeline().getEvents();
  const reactionsByEvent = new Map<string, Map<string, string[]>>();

  timelineEvents.forEach((event) => {
    if (event.getType() !== "m.reaction") return;
    const relates = event.getContent()?.["m.relates_to"];
    if (!relates?.event_id || !relates?.key) return;
    const bucket = reactionsByEvent.get(relates.event_id) ?? new Map();
    const users = bucket.get(relates.key) ?? [];
    users.push(event.getSender() ?? "");
    bucket.set(relates.key, users);
    reactionsByEvent.set(relates.event_id, bucket);
  });

  const pinnedEvent = room.currentState.getStateEvents(EventType.RoomPinnedEvents, "");
  const pinnedIds = new Set<string>(pinnedEvent?.getContent()?.pinned ?? []);

  return timelineEvents.flatMap((event): Message[] => {
    if (event.getType() === EventType.RoomMessage) {
      if (event.isRedacted()) return [];
      const content = event.getContent() ?? {};
      const relates = content["m.relates_to"] ?? {};
      const replyToId = relates?.["m.in_reply_to"]?.event_id ?? undefined;
      const threadRootId =
        relates?.rel_type === "m.thread" && typeof relates.event_id === "string"
          ? relates.event_id
          : undefined;
      const attachments: Attachment[] = [];

      if (content.msgtype === "m.image" || content.msgtype === "m.file") {
        const url = content.url
          ? client.mxcUrlToHttp(content.url, 320, 320, "scale") ?? undefined
          : undefined;
        attachments.push({
          id: uid("att"),
          name: content.body ?? "file",
          type: content.msgtype === "m.image" ? "image" : "file",
          size: content.info?.size ?? 0,
          url
        });
      }

      const reactionMap = reactionsByEvent.get(event.getId() ?? "") ?? new Map();
      const reactions = Array.from(reactionMap.entries()).map(([emoji, userIds]) => ({
        emoji,
        userIds
      }));

      return [
        {
          id: event.getId() ?? uid("m"),
          roomId: room.roomId,
          authorId: event.getSender() ?? "",
          body: content.body ?? "",
          timestamp: event.getTs(),
          reactions,
          attachments: attachments.length ? attachments : undefined,
          replyToId,
          threadRootId,
          pinned: pinnedIds.has(event.getId() ?? "")
        }
      ];
    }

    if (event.getType() === EventType.RoomMember) {
      const content = event.getContent() ?? {};
      const membership = typeof content.membership === "string" ? content.membership : "";
      const previousContent =
        typeof event.getPrevContent === "function"
          ? event.getPrevContent() ?? {}
          : ((event.event as { unsigned?: { prev_content?: Record<string, unknown> } } | undefined)?.unsigned
              ?.prev_content ?? {});
      const previousMembership =
        typeof (previousContent as Record<string, unknown>).membership === "string"
          ? ((previousContent as Record<string, unknown>).membership as string)
          : "";
      if (!membership || membership === previousMembership) return [];

      const targetUserId = event.getStateKey() ?? event.getSender() ?? "";
      const targetDisplayName =
        typeof content.displayname === "string" && content.displayname.trim()
          ? content.displayname
          : targetUserId;
      const senderUserId = event.getSender() ?? targetUserId;

      let body = "";
      if (membership === "join") {
        body =
          previousMembership === "invite"
            ? `${targetDisplayName} joined from invite`
            : `${targetDisplayName} joined the room`;
      } else if (membership === "leave") {
        body = previousMembership === "join" ? `${targetDisplayName} left the room` : `${targetDisplayName} left`;
      } else if (membership === "invite") {
        body = `${senderUserId} invited ${targetDisplayName}`;
      } else if (membership === "ban") {
        body = `${targetDisplayName} was banned`;
      } else if (membership === "knock") {
        body = `${targetDisplayName} requested to join`;
      }

      if (!body) return [];
      return [
        {
          id: event.getId() ?? uid("sys"),
          roomId: room.roomId,
          authorId: targetUserId || senderUserId,
          body,
          timestamp: event.getTs(),
          reactions: [],
          system: true
        }
      ];
    }

    return [];
  });
};

export const getRedactionTargetEventId = (event: MatrixEvent) => {
  const raw = event.event as { redacts?: string; content?: { redacts?: string } } | undefined;
  if (typeof raw?.redacts === "string" && raw.redacts.trim()) {
    return raw.redacts;
  }
  const contentValue = event.getContent()?.redacts;
  if (typeof contentValue === "string" && contentValue.trim()) {
    return contentValue;
  }
  return "";
};

export const loadRoomMessagesWithBackfill = async (
  client: MatrixClient,
  room: MatrixRoom,
  maxPages: number = 4
) => {
  let messages = mapEventsToMessages(client, room);
  const paginate =
    typeof (client as unknown as { paginateEventTimeline?: unknown }).paginateEventTimeline === "function"
      ? client.paginateEventTimeline.bind(client)
      : null;
  if (!paginate) {
    return { messages, hasMore: false };
  }
  let hasMore = true;
  let pagesLoaded = 0;
  while (messages.length === 0 && hasMore && pagesLoaded < maxPages) {
    pagesLoaded += 1;
    hasMore = await paginate(room.getLiveTimeline(), {
      backwards: true,
      limit: 40
    });
    messages = mapEventsToMessages(client, room);
  }
  return { messages, hasMore };
};
