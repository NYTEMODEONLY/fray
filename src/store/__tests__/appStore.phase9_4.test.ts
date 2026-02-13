import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventStatus, MatrixEventEvent } from "matrix-js-sdk";
import { Message, Room, Space } from "../../types";
import { useAppStore } from "../appStore";

const space: Space = { id: "s_phase9_4", name: "Phase 9.4", icon: "P" };
const room: Room = {
  id: "r_general",
  spaceId: space.id,
  name: "general",
  type: "text",
  category: "channels",
  unreadCount: 0
};

const localEchoMessageId = `~${room.id}:txn_1`;
const PENDING_REDACTIONS_KEY = "fray.pending_redactions";

const resetStore = () => {
  const message: Message = {
    id: localEchoMessageId,
    roomId: room.id,
    authorId: "@ava:example.com",
    body: "pending",
    timestamp: Date.now(),
    reactions: []
  };

  useAppStore.setState((state) => ({
    ...state,
    matrixClient: null,
    spaces: [space],
    currentSpaceId: space.id,
    currentRoomId: room.id,
    rooms: [{ ...room }],
    messagesByRoomId: { [room.id]: [message] },
    moderationAuditBySpaceId: {},
    notifications: []
  }));
};

describe("Phase 9.4 redact local-echo reliability", () => {
  beforeEach(() => {
    window.localStorage.removeItem(PENDING_REDACTIONS_KEY);
    resetStore();
  });

  it("queues delete for sending local-echo events instead of calling matrix redaction immediately", async () => {
    const once = vi.fn();
    const findEventById = vi.fn(() => ({ status: EventStatus.SENDING, once }));
    const redactEvent = vi.fn().mockResolvedValue(undefined);

    useAppStore.setState((state) => ({
      ...state,
      matrixClient: {
        getRoom: () => ({
          roomId: room.id,
          findEventById,
          getLiveTimeline: () => ({ getEvents: () => [] }),
          currentState: { getStateEvents: () => undefined }
        }),
        redactEvent,
        sendStateEvent: vi.fn().mockResolvedValue(undefined),
        cancelPendingEvent: vi.fn()
      } as never
    }));

    await useAppStore.getState().redactMessage(localEchoMessageId);

    expect(redactEvent).not.toHaveBeenCalled();
    expect(findEventById).toHaveBeenCalledWith(localEchoMessageId);
    expect(once).toHaveBeenCalledTimes(1);
    expect(once.mock.calls[0]?.[0]).toBe(MatrixEventEvent.LocalEventIdReplaced);
    expect(useAppStore.getState().notifications[0]?.title).toBe("Delete queued");
    const queued = JSON.parse(window.localStorage.getItem(PENDING_REDACTIONS_KEY) ?? "[]") as Array<{
      roomId: string;
      transactionId: string;
    }>;
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      roomId: room.id,
      transactionId: "txn_1",
      sourceMessageId: localEchoMessageId
    });
  });

  it("redacts the remote echo after local event id replacement", async () => {
    let onLocalIdReplaced: ((event: { getId: () => string }) => void) | undefined;
    const once = vi.fn((eventName: string, handler: (event: { getId: () => string }) => void) => {
      if (eventName === MatrixEventEvent.LocalEventIdReplaced) {
        onLocalIdReplaced = handler;
      }
    });

    const findEventById = vi.fn(() => ({ status: EventStatus.SENDING, once }));
    const redactEvent = vi.fn().mockResolvedValue(undefined);

    useAppStore.setState((state) => ({
      ...state,
      matrixClient: {
        getRoom: () => ({
          roomId: room.id,
          findEventById,
          getLiveTimeline: () => ({ getEvents: () => [] }),
          currentState: { getStateEvents: () => undefined }
        }),
        redactEvent,
        sendStateEvent: vi.fn().mockResolvedValue(undefined),
        cancelPendingEvent: vi.fn()
      } as never
    }));

    await useAppStore.getState().redactMessage(localEchoMessageId);
    expect(onLocalIdReplaced).toBeTypeOf("function");

    onLocalIdReplaced?.({ getId: () => "$evt_remote" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(redactEvent).toHaveBeenCalledWith(room.id, "$evt_remote");

    const audit = useAppStore.getState().moderationAuditBySpaceId[space.id] ?? [];
    expect(audit[0]?.sourceEventId).toBe(localEchoMessageId);
    expect(useAppStore.getState().notifications.some((item) => item.title === "Unable to delete message")).toBe(false);
  });

  it("reconciles persisted queued deletes after room selection and redacts remote echo", async () => {
    window.localStorage.setItem(
      PENDING_REDACTIONS_KEY,
      JSON.stringify([
        {
          roomId: room.id,
          transactionId: "txn_1",
          sourceMessageId: localEchoMessageId,
          queuedAt: Date.now()
        }
      ])
    );

    const redactEvent = vi.fn().mockResolvedValue(undefined);
    const timelineEvents = [
      {
        getType: () => "m.room.message",
        isRedacted: () => false,
        getContent: () => ({ body: "pending", msgtype: "m.text" }),
        getId: () => "$evt_remote",
        getSender: () => "@ava:example.com",
        getTs: () => Date.now(),
        getUnsigned: () => ({ transaction_id: "txn_1" })
      }
    ];

    useAppStore.setState((state) => ({
      ...state,
      matrixClient: {
        getRoom: () => ({
          roomId: room.id,
          getLiveTimeline: () => ({ getEvents: () => timelineEvents }),
          currentState: { getStateEvents: () => undefined },
          getJoinedMembers: () => [
            {
              userId: "@ava:example.com",
              name: "ava",
              powerLevel: 0,
              getMxcAvatarUrl: () => undefined
            }
          ]
        }),
        getUserId: () => "@ava:example.com",
        redactEvent,
        sendStateEvent: vi.fn().mockResolvedValue(undefined)
      } as never
    }));

    useAppStore.getState().selectRoom(room.id);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(redactEvent).toHaveBeenCalledWith(room.id, "$evt_remote");
    expect(window.localStorage.getItem(PENDING_REDACTIONS_KEY)).toBeNull();
  });

  it("keeps non-target messages when timeline re-map is temporarily empty after redaction", async () => {
    const targetEventId = "$evt-1";
    const keepMessage: Message = {
      id: "$evt-2",
      roomId: room.id,
      authorId: "@ava:example.com",
      body: "keep me",
      timestamp: Date.now() + 1,
      reactions: []
    };
    const redactEvent = vi.fn().mockResolvedValue(undefined);

    useAppStore.setState((state) => ({
      ...state,
      matrixClient: {
        getRoom: () => ({
          roomId: room.id,
          getLiveTimeline: () => ({ getEvents: () => [] }),
          currentState: { getStateEvents: () => undefined }
        }),
        redactEvent,
        sendStateEvent: vi.fn().mockResolvedValue(undefined)
      } as never,
      messagesByRoomId: {
        [room.id]: [
          {
            id: targetEventId,
            roomId: room.id,
            authorId: "@ava:example.com",
            body: "delete me",
            timestamp: Date.now(),
            reactions: []
          },
          keepMessage
        ]
      }
    }));

    await useAppStore.getState().redactMessage(targetEventId);

    expect(redactEvent).toHaveBeenCalledWith(room.id, targetEventId);
    const remaining = useAppStore.getState().messagesByRoomId[room.id] ?? [];
    expect(remaining.map((message) => message.id)).toEqual(["$evt-2"]);
  });

  it("keeps older cached messages when redaction occurs and live timeline is only partial", async () => {
    const targetEventId = "$evt-target";
    const olderMessageId = "$evt-older";
    const liveMessageId = "$evt-live";

    const redactEvent = vi.fn().mockResolvedValue(undefined);
    const timelineEvents = [
      {
        getType: () => "m.room.message",
        isRedacted: () => false,
        getContent: () => ({ body: "still visible from live timeline", msgtype: "m.text" }),
        getId: () => liveMessageId,
        getSender: () => "@ava:example.com",
        getTs: () => 3_000
      }
    ];

    useAppStore.setState((state) => ({
      ...state,
      matrixClient: {
        getRoom: () => ({
          roomId: room.id,
          getLiveTimeline: () => ({ getEvents: () => timelineEvents }),
          currentState: { getStateEvents: () => undefined }
        }),
        redactEvent,
        sendStateEvent: vi.fn().mockResolvedValue(undefined)
      } as never,
      messagesByRoomId: {
        [room.id]: [
          {
            id: olderMessageId,
            roomId: room.id,
            authorId: "@ava:example.com",
            body: "older cached history",
            timestamp: 1_000,
            reactions: []
          },
          {
            id: targetEventId,
            roomId: room.id,
            authorId: "@ava:example.com",
            body: "delete me",
            timestamp: 2_000,
            reactions: []
          },
          {
            id: liveMessageId,
            roomId: room.id,
            authorId: "@ava:example.com",
            body: "cached copy of live message",
            timestamp: 3_000,
            reactions: []
          }
        ]
      }
    }));

    await useAppStore.getState().redactMessage(targetEventId);

    expect(redactEvent).toHaveBeenCalledWith(room.id, targetEventId);
    const remaining = useAppStore.getState().messagesByRoomId[room.id] ?? [];
    expect(remaining.map((message) => message.id)).toEqual([olderMessageId, liveMessageId]);
  });

  it("backfills room history when initial live timeline has no message events", async () => {
    const timelineEvents: Array<{
      getType: () => string;
      isRedacted: () => boolean;
      getContent: () => Record<string, unknown>;
      getId: () => string;
      getSender: () => string;
      getTs: () => number;
    }> = [];

    const roomMock = {
      roomId: room.id,
      getLiveTimeline: () => ({ getEvents: () => timelineEvents }),
      currentState: { getStateEvents: () => undefined },
      getJoinedMembers: () => [
        {
          userId: "@me:example.com",
          name: "me",
          powerLevel: 100,
          getMxcAvatarUrl: () => undefined
        }
      ]
    };

    const paginateEventTimeline = vi.fn(async () => {
      timelineEvents.push({
        getType: () => "m.room.message",
        isRedacted: () => false,
        getContent: () => ({ body: "restored from history", msgtype: "m.text" }),
        getId: () => "$evt-restored",
        getSender: () => "@ava:example.com",
        getTs: () => Date.now()
      });
      return false;
    });

    useAppStore.setState((state) => ({
      ...state,
      spaces: [space],
      rooms: [{ ...room }],
      currentSpaceId: space.id,
      currentRoomId: room.id,
      messagesByRoomId: { [room.id]: [] },
      matrixClient: {
        getRoom: (roomId: string) => (roomId === room.id ? (roomMock as never) : null),
        getUserId: () => "@me:example.com",
        mxcUrlToHttp: () => null,
        paginateEventTimeline
      } as never
    }));

    useAppStore.getState().selectRoom(room.id);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(paginateEventTimeline).toHaveBeenCalled();
    const hydrated = useAppStore.getState().messagesByRoomId[room.id] ?? [];
    expect(hydrated[0]?.id).toBe("$evt-restored");
  });

  it("maps membership transitions into persistent system timeline messages", () => {
    const joinedEvent = {
      getType: () => "m.room.member",
      getContent: () => ({ membership: "join", displayname: "ava" }),
      getPrevContent: () => ({ membership: "invite" }),
      getStateKey: () => "@ava:example.com",
      getSender: () => "@ava:example.com",
      getTs: () => 9_000,
      getId: () => "$evt-join"
    };

    const roomMock = {
      roomId: room.id,
      getLiveTimeline: () => ({ getEvents: () => [joinedEvent] }),
      currentState: { getStateEvents: () => undefined },
      getJoinedMembers: () => [
        {
          userId: "@me:example.com",
          name: "me",
          powerLevel: 100,
          getMxcAvatarUrl: () => undefined
        },
        {
          userId: "@ava:example.com",
          name: "ava",
          powerLevel: 0,
          getMxcAvatarUrl: () => undefined
        }
      ]
    };

    useAppStore.setState((state) => ({
      ...state,
      matrixClient: {
        getRoom: (roomId: string) => (roomId === room.id ? (roomMock as never) : null),
        getUserId: () => "@me:example.com",
        mxcUrlToHttp: () => null
      } as never,
      spaces: [space],
      rooms: [{ ...room }],
      currentSpaceId: space.id,
      currentRoomId: room.id,
      messagesByRoomId: { [room.id]: [] }
    }));

    useAppStore.getState().selectRoom(room.id);

    const messages = useAppStore.getState().messagesByRoomId[room.id] ?? [];
    expect(messages).toHaveLength(1);
    expect(messages[0]?.id).toBe("$evt-join");
    expect(messages[0]?.system).toBe(true);
    expect(messages[0]?.body).toContain("joined");
  });
});
