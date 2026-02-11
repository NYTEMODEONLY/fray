import { beforeEach, describe, expect, it } from "vitest";
import { Message, Room, Space } from "../../types";
import { useAppStore } from "../appStore";

const space: Space = { id: "s_phase4", name: "Phase 4", icon: "P" };

const rooms: Room[] = [
  {
    id: "r_general",
    spaceId: "s_phase4",
    name: "general",
    type: "text",
    category: "channels",
    unreadCount: 3
  }
];

const messages: Message[] = [
  {
    id: "$root",
    roomId: "r_general",
    authorId: "@ava:example.com",
    body: "root",
    timestamp: 10_000,
    reactions: []
  },
  {
    id: "$reply",
    roomId: "r_general",
    authorId: "@ava:example.com",
    body: "thread reply",
    timestamp: 12_000,
    reactions: [],
    threadRootId: "$root"
  }
];

const resetStore = () => {
  useAppStore.setState((state) => ({
    ...state,
    matrixClient: null,
    spaces: [space],
    currentSpaceId: space.id,
    currentRoomId: "r_general",
    rooms: rooms.map((room) => ({ ...room })),
    messagesByRoomId: { r_general: messages.map((message) => ({ ...message })) },
    roomLastReadTsByRoomId: { r_general: 0 },
    threadLastViewedTsByRoomId: {},
    notifications: []
  }));
};

describe("Phase 4 store state controls", () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
  });

  it("marks rooms read up to latest message", () => {
    useAppStore.getState().markRoomRead("r_general");
    expect(useAppStore.getState().roomLastReadTsByRoomId.r_general).toBe(12_000);
    expect(useAppStore.getState().rooms.find((room) => room.id === "r_general")?.unreadCount).toBe(0);
  });

  it("tracks thread read timestamp when opening a thread", () => {
    useAppStore.getState().toggleThread("$root");
    expect(useAppStore.getState().showThread).toBe(true);
    expect(useAppStore.getState().threadLastViewedTsByRoomId.r_general.$root).toBe(12_000);
  });

  it("persists message density in preferences", () => {
    useAppStore.getState().setMessageDensity("compact");
    expect(useAppStore.getState().messageDensity).toBe("compact");
    const stored = localStorage.getItem("fray.preferences") ?? "{}";
    expect(stored).toContain("\"messageDensity\":\"compact\"");
  });
});
