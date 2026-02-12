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
});
