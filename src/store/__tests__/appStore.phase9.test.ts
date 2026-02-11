import { beforeEach, describe, expect, it, vi } from "vitest";
import { Room } from "../../types";
import { useAppStore } from "../appStore";

const DEFAULT_SPACE_ID = "all";
const SPACE_LAYOUT_EVENT = "com.fray.space_layout";
const SERVER_META_EVENT = "com.fray.server_meta";
const ROOM_TYPE_EVENT = "com.fray.room_type";

const baseRooms: Room[] = [
  {
    id: "r_delete",
    spaceId: DEFAULT_SPACE_ID,
    name: "delete-me",
    type: "text",
    category: "channels",
    unreadCount: 0
  },
  {
    id: "r_keep",
    spaceId: DEFAULT_SPACE_ID,
    name: "keep-me",
    type: "text",
    category: "channels",
    unreadCount: 0
  }
];

describe("Phase 9 no-space admin flows", () => {
  beforeEach(() => {
    useAppStore.setState((state) => ({
      ...state,
      spaces: [{ id: DEFAULT_SPACE_ID, name: "All Rooms", icon: "M" }],
      currentSpaceId: DEFAULT_SPACE_ID,
      currentRoomId: "r_delete",
      rooms: baseRooms.map((room) => ({ ...room })),
      categoriesBySpaceId: {
        [DEFAULT_SPACE_ID]: [{ id: "channels", name: "Channels", order: 0 }]
      },
      spaceLayoutsBySpaceId: {
        [DEFAULT_SPACE_ID]: {
          version: 1,
          categories: [{ id: "channels", name: "Channels", order: 0 }],
          rooms: {
            r_delete: { categoryId: "channels", order: 0 },
            r_keep: { categoryId: "channels", order: 1 }
          }
        }
      },
      spaceStateHostRoomIdBySpaceId: {
        [DEFAULT_SPACE_ID]: "r_delete"
      },
      notifications: []
    }));
  });

  it("renames no-space server via server-meta event without renaming a channel", async () => {
    const sendStateEvent = vi.fn().mockResolvedValue(undefined);
    const setRoomName = vi.fn().mockResolvedValue(undefined);

    useAppStore.setState((state) => ({
      ...state,
      matrixClient: {
        sendStateEvent,
        setRoomName
      } as never
    }));

    await useAppStore.getState().renameSpace(DEFAULT_SPACE_ID, "Ops Hub");

    expect(setRoomName).not.toHaveBeenCalled();
    expect(sendStateEvent).toHaveBeenCalledWith(
      "r_delete",
      SERVER_META_EVENT,
      { name: "Ops Hub" },
      ""
    );

    const state = useAppStore.getState();
    expect(state.spaces[0]?.name).toBe("Ops Hub");
    expect(state.rooms.find((room) => room.id === "r_delete")?.name).toBe("delete-me");
  });

  it("deletes channel in no-space mode even when room delete marker write fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const sendStateEvent = vi.fn(async (roomId: string, eventType: string) => {
      if (roomId === "r_delete" && eventType === ROOM_TYPE_EVENT) {
        throw new Error("forbidden");
      }
      return undefined;
    });
    const leave = vi.fn().mockResolvedValue(undefined);
    const forget = vi.fn().mockResolvedValue(undefined);

    useAppStore.setState((state) => ({
      ...state,
      matrixClient: {
        getRoom: (roomId: string) =>
          roomId === "r_delete"
            ? {
                currentState: {
                  getStateEvents: (eventType: string) =>
                    eventType === ROOM_TYPE_EVENT
                      ? {
                          getContent: () => ({ type: "text" })
                        }
                      : undefined
                }
              }
            : undefined,
        sendStateEvent,
        leave,
        forget
      } as never
    }));

    await useAppStore.getState().deleteRoom("r_delete");

    expect(sendStateEvent).toHaveBeenCalledWith(
      "r_delete",
      ROOM_TYPE_EVENT,
      { type: "text", deleted: true },
      ""
    );
    expect(sendStateEvent).toHaveBeenCalledWith(
      "r_delete",
      SPACE_LAYOUT_EVENT,
      {
        version: 1,
        categories: [{ id: "channels", name: "Channels", order: 0 }],
        rooms: {
          r_keep: { categoryId: "channels", order: 0 }
        }
      },
      ""
    );

    const state = useAppStore.getState();
    expect(state.rooms.find((room) => room.id === "r_delete")).toBeUndefined();
    expect(state.currentRoomId).toBe("r_keep");
    expect(leave).toHaveBeenCalledWith("r_delete");
    expect(forget).toHaveBeenCalledWith("r_delete");
    warnSpy.mockRestore();
  });
});
