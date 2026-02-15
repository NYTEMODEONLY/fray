import type { AppState, AppStateGet, AppStateSet, Message, ModerationAuditEvent } from "../shared";
import {
  AUDIT_LOG_EVENT,
  EventStatus,
  EventType,
  MatrixEventEvent,
  MsgType,
  RelationType,
  createNotification,
  defaultMockMessagesByRoomId,
  findRemoteEchoEventId,
  getLocalEchoTransactionId,
  mapEventsToMessages,
  queuePendingRedactionIntent,
  removePendingRedactionIntent,
  resolveTimelineMessages,
  trackLocalMetricEvent,
  uid
} from "../shared";

export type MessagesSliceState = Pick<
  AppState,
  | "messagesByRoomId"
  | "threadRootId"
  | "replyToId"
  | "showThread"
  | "showPins"
  | "toggleThread"
  | "togglePins"
  | "sendMessage"
  | "toggleReaction"
  | "togglePin"
  | "redactMessage"
  | "copyMessageLink"
  | "startReply"
  | "clearReply"
  | "simulateIncoming"
>;

export const createMessagesSliceState = (
  set: AppStateSet,
  get: AppStateGet
): MessagesSliceState => ({
  messagesByRoomId: defaultMockMessagesByRoomId,
  threadRootId: null,
  replyToId: null,
  showThread: false,
  showPins: false,
  toggleThread: (rootId) =>
    set((state) => {
      if (rootId === null) {
        return { showThread: false, threadRootId: null };
      }
      if (typeof rootId === "string") {
        const threadMessages = (state.messagesByRoomId[state.currentRoomId] ?? [])
          .filter((message) => message.threadRootId === rootId)
          .sort((left, right) => left.timestamp - right.timestamp);
        const latestThreadTimestamp = threadMessages.length
          ? threadMessages[threadMessages.length - 1]?.timestamp ?? Date.now()
          : Date.now();
        return {
          showThread: true,
          threadRootId: rootId,
          threadLastViewedTsByRoomId: {
            ...state.threadLastViewedTsByRoomId,
            [state.currentRoomId]: {
              ...(state.threadLastViewedTsByRoomId[state.currentRoomId] ?? {}),
              [rootId]: latestThreadTimestamp
            }
          }
        };
      }
      return { showThread: !state.showThread };
    }),
  togglePins: () => set((state) => ({ showPins: !state.showPins })),
  sendMessage: async ({ body, attachments = [], threadRootId }) => {
    const client = get().matrixClient;
    const roomId = get().currentRoomId;
    const replyToId = get().replyToId ?? undefined;

    if (!client) {
      set((state) => {
        const timestamp = Date.now();
        const message: Message = {
          id: uid("m"),
          roomId,
          authorId: state.me.id,
          body,
          timestamp,
          reactions: [],
          attachments: attachments.length ? attachments : undefined,
          replyToId,
          threadRootId,
          status: state.isOnline ? "sent" : "queued"
        };
        const existing = state.messagesByRoomId[roomId] ?? [];
        const nextThreadViewed =
          typeof threadRootId === "string"
            ? {
                ...state.threadLastViewedTsByRoomId,
                [roomId]: {
                  ...(state.threadLastViewedTsByRoomId[roomId] ?? {}),
                  [threadRootId]: timestamp
                }
              }
            : state.threadLastViewedTsByRoomId;
        return {
          messagesByRoomId: { ...state.messagesByRoomId, [roomId]: [...existing, message] },
          replyToId: null,
          roomLastReadTsByRoomId: {
            ...state.roomLastReadTsByRoomId,
            [roomId]: timestamp
          },
          threadLastViewedTsByRoomId: nextThreadViewed,
          rooms: state.rooms.map((room) =>
            room.id === roomId ? { ...room, unreadCount: 0 } : room
          )
        };
      });
      trackLocalMetricEvent("message_send_success", {
        mode: "local",
        roomId,
        threaded: Boolean(threadRootId)
      });
      if (get().onboardingStep !== null && (body.trim() || attachments.length > 0)) {
        get().completeOnboarding();
      }
      return;
    }

    const relates: Record<string, any> = {};
    if (replyToId) {
      relates["m.in_reply_to"] = { event_id: replyToId };
    }
    if (threadRootId) {
      relates.rel_type = "m.thread";
      relates.event_id = threadRootId;
    }

    if (body.trim()) {
      await client.sendEvent(roomId, EventType.RoomMessage, {
        msgtype: MsgType.Text,
        body,
        "m.relates_to": Object.keys(relates).length ? relates : undefined
      });
    }

    for (const attachment of attachments) {
      if (!attachment.file) continue;
      try {
        const upload = await client.uploadContent(attachment.file);
        const contentUri = upload.content_uri as string;
        if (!contentUri) continue;
        if (attachment.type === "image") {
          await client.sendEvent(roomId, EventType.RoomMessage, {
            msgtype: MsgType.Image,
            body: attachment.name,
            url: contentUri,
            info: {
              mimetype: attachment.file.type,
              size: attachment.file.size
            }
          });
        } else {
          await client.sendEvent(roomId, EventType.RoomMessage, {
            msgtype: MsgType.File,
            body: attachment.name,
            url: contentUri,
            info: {
              mimetype: attachment.file.type,
              size: attachment.file.size
            }
          });
        }
      } catch (error) {
        console.warn("Failed to upload attachment", error);
      }
    }

    trackLocalMetricEvent("message_send_success", {
      mode: "matrix",
      roomId,
      threaded: Boolean(threadRootId)
    });
    set({ replyToId: null });
    get().markRoomRead(roomId);

    if (threadRootId) {
      set((state) => ({
        threadLastViewedTsByRoomId: {
          ...state.threadLastViewedTsByRoomId,
          [roomId]: {
            ...(state.threadLastViewedTsByRoomId[roomId] ?? {}),
            [threadRootId]: Date.now()
          }
        }
      }));
    }
    if (get().onboardingStep !== null && (body.trim() || attachments.length > 0)) {
      get().completeOnboarding();
    }
  },
  toggleReaction: async (messageId, emoji) => {
    const client = get().matrixClient;
    if (!client) {
      set((state) => ({
        messagesByRoomId: {
          ...state.messagesByRoomId,
          [state.currentRoomId]: (state.messagesByRoomId[state.currentRoomId] ?? []).map((message) => {
            if (message.id !== messageId) return message;
            const existing = message.reactions.find((reaction) => reaction.emoji === emoji);
            if (!existing) {
              return {
                ...message,
                reactions: [...message.reactions, { emoji, userIds: [state.me.id] }]
              };
            }
            const hasReacted = existing.userIds.includes(state.me.id);
            const updated = hasReacted
              ? existing.userIds.filter((id) => id !== state.me.id)
              : [...existing.userIds, state.me.id];
            const reactions = updated.length
              ? message.reactions.map((reaction) =>
                  reaction.emoji === emoji ? { ...reaction, userIds: updated } : reaction
                )
              : message.reactions.filter((reaction) => reaction.emoji !== emoji);
            return { ...message, reactions };
          })
        }
      }));
      return;
    }

    const room = client.getRoom(get().currentRoomId);
    if (!room) return;
    const existing = room
      .getLiveTimeline()
      .getEvents()
      .find((event) => {
        if (event.getType() !== "m.reaction") return false;
        if (event.getSender() !== client.getUserId()) return false;
        const relates = event.getContent()?.["m.relates_to"];
        return relates?.event_id === messageId && relates?.key === emoji;
      });

    if (existing?.getId()) {
      await client.redactEvent(room.roomId, existing.getId()!);
      return;
    }

    await client.sendEvent(room.roomId, EventType.Reaction, {
      "m.relates_to": {
        rel_type: RelationType.Annotation,
        event_id: messageId,
        key: emoji
      }
    });
  },
  togglePin: async (messageId) => {
    const client = get().matrixClient;
    if (!client) {
      set((state) => ({
        messagesByRoomId: {
          ...state.messagesByRoomId,
          [state.currentRoomId]: (state.messagesByRoomId[state.currentRoomId] ?? []).map((message) =>
            message.id === messageId ? { ...message, pinned: !message.pinned } : message
          )
        }
      }));
      return;
    }

    const room = client.getRoom(get().currentRoomId);
    if (!room) return;
    const pinnedEvent = room.currentState.getStateEvents(EventType.RoomPinnedEvents, "");
    const pinned = new Set<string>(pinnedEvent?.getContent()?.pinned ?? []);
    if (pinned.has(messageId)) {
      pinned.delete(messageId);
    } else {
      pinned.add(messageId);
    }
    await client.sendStateEvent(room.roomId, EventType.RoomPinnedEvents, { pinned: Array.from(pinned) }, "");
    const messages = mapEventsToMessages(client, room);
    set((state) => ({
      messagesByRoomId: { ...state.messagesByRoomId, [room.roomId]: messages }
    }));
  },
  redactMessage: async (messageId) => {
    const client = get().matrixClient;
    const spaceId = get().currentSpaceId;
    const roomId = get().currentRoomId;
    const currentMessages = get().messagesByRoomId[roomId] ?? [];
    const targetMessage = currentMessages.find((message) => message.id === messageId);
    const createAuditEntry = (
      targetEventId: string,
      sourceEventId: string = targetEventId
    ): ModerationAuditEvent => ({
      id: uid("audit"),
      action: "message.redact",
      actorId: get().me.id,
      target: targetMessage ? `${targetMessage.authorId}:${targetEventId}` : targetEventId,
      timestamp: Date.now(),
      sourceEventId
    });

    if (!client) {
      const auditEntry = createAuditEntry(messageId);
      set((state) => ({
        messagesByRoomId: {
          ...state.messagesByRoomId,
          [roomId]: (state.messagesByRoomId[roomId] ?? []).filter((message) => message.id !== messageId)
        },
        moderationAuditBySpaceId: {
          ...state.moderationAuditBySpaceId,
          [spaceId]: [auditEntry, ...(state.moderationAuditBySpaceId[spaceId] ?? [])].slice(0, 250)
        }
      }));
      trackLocalMetricEvent("moderation_action_success", {
        mode: "local",
        action: "redact",
        roomId
      });
      return;
    }

    const room = client.getRoom(roomId);
    if (!room) return;

    const commitMatrixDelete = async (targetEventId: string, sourceEventId: string = targetEventId) => {
      const timelineMessages = mapEventsToMessages(client, room);
      const auditEntry = createAuditEntry(targetEventId, sourceEventId);
      const nextAudit = [auditEntry, ...(get().moderationAuditBySpaceId[spaceId] ?? [])].slice(0, 250);
      await client
        .sendStateEvent(spaceId, AUDIT_LOG_EVENT as any, { version: 1, events: nextAudit }, "")
        .catch(() => undefined);

      set((state) => ({
        messagesByRoomId: {
          ...state.messagesByRoomId,
          [room.roomId]: resolveTimelineMessages({
            existingMessages: state.messagesByRoomId[room.roomId] ?? [],
            timelineMessages,
            removeMessageIds: [targetEventId, sourceEventId]
          })
        },
        moderationAuditBySpaceId: {
          ...state.moderationAuditBySpaceId,
          [spaceId]: nextAudit
        }
      }));
      trackLocalMetricEvent("moderation_action_success", {
        mode: "matrix",
        action: "redact",
        roomId: room.roomId
      });
    };

    const redactServerEvent = async (targetEventId: string, sourceEventId: string = targetEventId) => {
      await client.redactEvent(room.roomId, targetEventId);
      await commitMatrixDelete(targetEventId, sourceEventId);
    };

    if (messageId.startsWith("~")) {
      const localEvent = typeof room.findEventById === "function" ? room.findEventById(messageId) : undefined;
      const localStatus = localEvent?.status ?? null;
      const transactionId = getLocalEchoTransactionId(room.roomId, messageId);

      if (
        localEvent &&
        (localStatus === EventStatus.QUEUED ||
          localStatus === EventStatus.NOT_SENT ||
          localStatus === EventStatus.ENCRYPTING)
      ) {
        try {
          client.cancelPendingEvent(localEvent);
          await commitMatrixDelete(messageId);
          if (transactionId) {
            removePendingRedactionIntent(room.roomId, transactionId);
          }
          return;
        } catch (error) {
          console.warn("Failed to cancel pending event before delete, retrying via remote echo path", error);
        }
      }

      if (transactionId) {
        const remoteEchoEventId = findRemoteEchoEventId(room, transactionId);
        if (remoteEchoEventId && !remoteEchoEventId.startsWith("~")) {
          try {
            await redactServerEvent(remoteEchoEventId, messageId);
            removePendingRedactionIntent(room.roomId, transactionId);
          } catch (error) {
            queuePendingRedactionIntent({
              roomId: room.roomId,
              transactionId,
              sourceMessageId: messageId,
              queuedAt: Date.now()
            });
            get().pushNotification("Unable to delete message", (error as Error).message);
          }
          return;
        }
      }

      if (localEvent) {
        if (transactionId) {
          queuePendingRedactionIntent({
            roomId: room.roomId,
            transactionId,
            sourceMessageId: messageId,
            queuedAt: Date.now()
          });
        }
        localEvent.once(MatrixEventEvent.LocalEventIdReplaced, (event) => {
          const remoteEventId = event.getId();
          if (!remoteEventId || remoteEventId.startsWith("~")) return;
          void redactServerEvent(remoteEventId, messageId).catch((error) => {
            get().pushNotification("Unable to delete message", (error as Error).message);
          }).finally(() => {
            if (transactionId) {
              removePendingRedactionIntent(room.roomId, transactionId);
            }
          });
        });
        get().pushNotification("Delete queued", "Message is still sending and will be deleted after sync.");
        return;
      }

      if (transactionId) {
        queuePendingRedactionIntent({
          roomId: room.roomId,
          transactionId,
          sourceMessageId: messageId,
          queuedAt: Date.now()
        });
        get().pushNotification(
          "Delete queued",
          "Message is still syncing and will be deleted after the server echo arrives."
        );
        return;
      }
      get().pushNotification("Unable to delete message", "Message is still syncing. Try again in a moment.");
      return;
    }

    try {
      await redactServerEvent(messageId);
    } catch (error) {
      get().pushNotification("Unable to delete message", (error as Error).message);
    }
  },
  copyMessageLink: async (messageId) => {
    const client = get().matrixClient;
    const roomId = get().currentRoomId;
    if (!roomId) return;
    const room = client?.getRoom(roomId);
    const target = room?.getCanonicalAlias() || roomId;
    const link = `https://matrix.to/#/${encodeURIComponent(target)}/${encodeURIComponent(messageId)}`;

    if (!navigator.clipboard?.writeText) {
      get().pushNotification("Message link", link);
      return;
    }

    try {
      await navigator.clipboard.writeText(link);
      get().pushNotification("Message link copied", link);
    } catch {
      get().pushNotification("Message link", link);
    }
  },
  startReply: (messageId) => set({ replyToId: messageId }),
  clearReply: () => set({ replyToId: null }),
  simulateIncoming: () =>
    set((state) => {
      const body = `@${state.me.name} check the latest onboarding tweaks in #welcome.`;
      const timestamp = Date.now();
      const message: Message = {
        id: uid("m"),
        roomId: state.currentRoomId,
        authorId: state.users[0]?.id ?? state.me.id,
        body,
        timestamp,
        reactions: []
      };
      const mentionHit = body.includes(`@${state.me.name}`);
      const existing = state.messagesByRoomId[state.currentRoomId] ?? [];
      return {
        messagesByRoomId: {
          ...state.messagesByRoomId,
          [state.currentRoomId]: [...existing, message]
        },
        rooms: state.rooms.map((room) =>
          room.id === state.currentRoomId ? { ...room, unreadCount: room.unreadCount + 1 } : room
        ),
        notifications: mentionHit
          ? [createNotification(`Mention in #${state.currentRoomId}`, body), ...state.notifications]
          : state.notifications
      };
    })
});
