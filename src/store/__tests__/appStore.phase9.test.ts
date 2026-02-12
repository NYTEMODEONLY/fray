import { beforeEach, describe, expect, it, vi } from "vitest";
import { Room } from "../../types";
import { useAppStore } from "../appStore";

const DEFAULT_SPACE_ID = "all";
const SPACE_LAYOUT_EVENT = "com.fray.space_layout";
const SERVER_META_EVENT = "com.fray.server_meta";

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

  it("deletes channel in no-space mode only after Synapse purge verification", async () => {
    const meId = useAppStore.getState().me.id;
    const sendStateEvent = vi.fn().mockResolvedValue(undefined);
    const leave = vi.fn().mockResolvedValue(undefined);
    const forget = vi.fn().mockResolvedValue(undefined);
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ delete_id: "del-1", status: "shutting_down" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ delete_id: "del-1", status: "complete" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
      .mockResolvedValueOnce(new Response("not found", { status: 404 }));

    useAppStore.setState((state) => ({
      ...state,
      matrixSession: {
        baseUrl: "https://matrix.example.com",
        accessToken: "admin-token",
        userId: meId,
        deviceId: "dev-1"
      },
      matrixClient: {
        getRoom: (roomId: string) =>
          roomId === "r_delete" || roomId === "r_keep"
            ? {
                getMember: () => ({ membership: "join" }),
                currentState: {
                  getStateEvents: () => ({
                    getContent: () => ({
                      users_default: 0,
                      users: { [meId]: 100 },
                      events_default: 0,
                      events: {},
                      state_default: 50,
                      invite: 0,
                      redact: 50
                    })
                  })
                }
              }
            : undefined,
        sendStateEvent,
        leave,
        forget
      } as never
    }));

    await useAppStore.getState().deleteRoom("r_delete");

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      "https://matrix.example.com/_synapse/admin/v2/rooms/r_delete",
      expect.objectContaining({ method: "DELETE" })
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      "https://matrix.example.com/_synapse/admin/v2/rooms/delete_status/del-1",
      expect.objectContaining({ method: "GET" })
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      3,
      "https://matrix.example.com/_synapse/admin/v1/rooms/r_delete",
      expect.objectContaining({ method: "GET" })
    );
    expect(sendStateEvent).toHaveBeenCalledWith(
      "r_keep",
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
    expect(state.notifications[0]?.title).toBe("Channel deleted");
    fetchSpy.mockRestore();
  });

  it("fails deletion if Synapse still reports the room after delete completion", async () => {
    const meId = useAppStore.getState().me.id;
    const sendStateEvent = vi.fn().mockResolvedValue(undefined);
    const leave = vi.fn().mockResolvedValue(undefined);
    const forget = vi.fn().mockResolvedValue(undefined);
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ delete_id: "del-2", status: "shutting_down" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ delete_id: "del-2", status: "complete" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "room still present" }), {
          status: 500,
          headers: { "content-type": "application/json" }
        })
      );

    useAppStore.setState((state) => ({
      ...state,
      matrixSession: {
        baseUrl: "https://matrix.example.com",
        accessToken: "admin-token",
        userId: meId,
        deviceId: "dev-1"
      },
      matrixClient: {
        getRoom: (roomId: string) =>
          roomId === "r_delete" || roomId === "r_keep"
            ? {
                getMember: () => ({ membership: "join" }),
                currentState: {
                  getStateEvents: () => ({
                    getContent: () => ({
                      users_default: 0,
                      users: { [meId]: 100 },
                      events_default: 0,
                      events: {},
                      state_default: 50,
                      invite: 0,
                      redact: 50
                    })
                  })
                }
              }
            : undefined,
        sendStateEvent,
        leave,
        forget
      } as never
    }));

    await useAppStore.getState().deleteRoom("r_delete");

    const state = useAppStore.getState();
    expect(state.rooms.find((room) => room.id === "r_delete")).toBeDefined();
    expect(sendStateEvent).not.toHaveBeenCalled();
    expect(leave).not.toHaveBeenCalled();
    expect(forget).not.toHaveBeenCalled();
    expect(state.notifications[0]?.title).toBe("Failed to permanently delete channel");
    expect(state.notifications[0]?.body).toContain("500");
    fetchSpy.mockRestore();
  });

  it("blocks channel deletion for non-admin users without explicit role grant", async () => {
    const meId = useAppStore.getState().me.id;
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    useAppStore.setState((state) => ({
      ...state,
      matrixSession: {
        baseUrl: "https://matrix.example.com",
        accessToken: "member-token",
        userId: meId,
        deviceId: "dev-2"
      },
      matrixClient: {
        getRoom: (roomId: string) =>
          roomId === "r_delete"
            ? {
                getMember: () => ({ membership: "join" }),
                currentState: {
                  getStateEvents: () => ({
                    getContent: () => ({
                      users_default: 0,
                      users: { [meId]: 0 },
                      events_default: 50,
                      events: {},
                      state_default: 50,
                      invite: 50,
                      redact: 50
                    })
                  })
                }
              }
            : undefined
      } as never
    }));

    await useAppStore.getState().deleteRoom("r_delete");

    const state = useAppStore.getState();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.rooms.find((room) => room.id === "r_delete")).toBeDefined();
    expect(state.notifications[0]?.title).toBe("Channel delete unavailable");
    fetchSpy.mockRestore();
  });
});
