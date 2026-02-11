import { beforeEach, describe, expect, it } from "vitest";
import { Room, Space } from "../../types";
import { useAppStore } from "../appStore";

const space: Space = { id: "s_phase8", name: "Phase 8", icon: "P" };

const baseRooms: Room[] = [
  {
    id: "r_delete",
    spaceId: "s_phase8",
    name: "delete-me",
    type: "text",
    category: "channels",
    unreadCount: 0
  },
  {
    id: "r_keep",
    spaceId: "s_phase8",
    name: "keep-me",
    type: "text",
    category: "channels",
    unreadCount: 0
  },
  {
    id: "r_dm",
    spaceId: "s_phase8",
    name: "@ava",
    type: "dm",
    unreadCount: 0
  }
];

const resetStore = () => {
  useAppStore.setState((state) => ({
    ...state,
    matrixClient: null,
    spaces: [space],
    currentSpaceId: space.id,
    currentRoomId: "r_delete",
    rooms: baseRooms.map((room) => ({ ...room })),
    categoriesBySpaceId: {},
    spaceLayoutsBySpaceId: {},
    notifications: []
  }));
  useAppStore.getState().selectSpace(space.id);
  useAppStore.setState((state) => ({
    ...state,
    currentRoomId: "r_delete"
  }));
};

describe("Phase 8 channel deletion", () => {
  beforeEach(() => {
    resetStore();
  });

  it("deletes a channel and reselects a fallback room in local mode", async () => {
    await useAppStore.getState().deleteRoom("r_delete");

    const state = useAppStore.getState();
    expect(state.rooms.find((room) => room.id === "r_delete")).toBeUndefined();
    expect(state.currentRoomId).toBe("r_keep");
    expect(state.notifications[0]?.title).toBe("Channel deleted");
  });

  it("ignores delete requests for DM rooms", async () => {
    await useAppStore.getState().deleteRoom("r_dm");
    const state = useAppStore.getState();
    expect(state.rooms.find((room) => room.id === "r_dm")).toBeDefined();
  });
});
