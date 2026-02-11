import { beforeEach, describe, expect, it } from "vitest";
import { Message, Room, Space } from "../../types";
import { useAppStore } from "../appStore";

const space: Space = { id: "s_phase3", name: "Phase 3", icon: "P" };

const rooms: Room[] = [
  {
    id: "r_general",
    spaceId: "s_phase3",
    name: "general",
    type: "text",
    category: "channels",
    unreadCount: 0
  }
];

const messages: Message[] = [
  {
    id: "$evt-1",
    roomId: "r_general",
    authorId: "@ava:example.com",
    body: "hello",
    timestamp: Date.now(),
    reactions: []
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
    permissionOverridesBySpaceId: {},
    moderationAuditBySpaceId: {},
    notifications: []
  }));
  useAppStore.getState().selectSpace(space.id);
};

describe("Phase 3 store permission + moderation actions", () => {
  beforeEach(() => {
    resetStore();
  });

  it("stores category and room permission overrides with audit entries", async () => {
    await useAppStore.getState().setCategoryPermissionRule("channels", "send", "deny");
    await useAppStore.getState().setRoomPermissionRule("r_general", "send", "allow");

    const overrides = useAppStore.getState().permissionOverridesBySpaceId[space.id];
    expect(overrides.categories.channels.send).toBe("deny");
    expect(overrides.rooms.r_general.send).toBe("allow");

    const audit = useAppStore.getState().moderationAuditBySpaceId[space.id] ?? [];
    expect(audit.length).toBeGreaterThanOrEqual(2);
    expect(audit[0].action).toContain("permission");
  });

  it("redacts messages in local fallback mode and records source event id", async () => {
    await useAppStore.getState().redactMessage("$evt-1");

    const roomMessages = useAppStore.getState().messagesByRoomId.r_general ?? [];
    expect(roomMessages).toHaveLength(0);

    const audit = useAppStore.getState().moderationAuditBySpaceId[space.id] ?? [];
    const redaction = audit.find((entry) => entry.action === "message.redact");
    expect(redaction?.sourceEventId).toBe("$evt-1");
  });
});
