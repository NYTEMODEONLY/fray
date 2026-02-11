import { beforeEach, describe, expect, it } from "vitest";
import { Room, ServerSettings, Space } from "../../types";
import { useAppStore } from "../appStore";

const space: Space = { id: "s_phase2", name: "Phase 2", icon: "P" };

const baseRooms: Room[] = [
  {
    id: "r_general",
    spaceId: "s_phase2",
    name: "general",
    type: "text",
    category: "channels",
    unreadCount: 0
  },
  {
    id: "r_design",
    spaceId: "s_phase2",
    name: "design",
    type: "text",
    category: "channels",
    unreadCount: 0
  },
  {
    id: "r_voice",
    spaceId: "s_phase2",
    name: "voice",
    type: "voice",
    category: "channels",
    unreadCount: 0
  },
  {
    id: "r_dm",
    spaceId: "s_phase2",
    name: "@ava",
    type: "dm",
    unreadCount: 0
  }
];

const resetPhase2Store = () => {
  useAppStore.setState((state) => ({
    ...state,
    matrixClient: null,
    spaces: [space],
    currentSpaceId: space.id,
    currentRoomId: baseRooms[0].id,
    rooms: baseRooms.map((room) => ({ ...room })),
    categoriesBySpaceId: {},
    spaceLayoutsBySpaceId: {},
    serverSettingsBySpaceId: {},
    notifications: []
  }));
  useAppStore.getState().selectSpace(space.id);
};

describe("Phase 2 store layout and settings", () => {
  beforeEach(() => {
    resetPhase2Store();
  });

  it("creates, reorders, and deletes categories while preserving room placement", async () => {
    const store = useAppStore.getState();

    await store.createCategory("Design Team");
    await store.createCategory("Voice");

    const afterCreate = useAppStore.getState();
    const categories = afterCreate.categoriesBySpaceId[space.id];
    const designCategory = categories.find((category) => category.name === "Design Team");
    const voiceCategory = categories.find((category) => category.name === "Voice");

    expect(designCategory).toBeDefined();
    expect(voiceCategory).toBeDefined();

    await useAppStore.getState().moveRoomToCategory("r_design", designCategory!.id);
    await useAppStore.getState().moveRoomToCategory("r_voice", voiceCategory!.id);
    await useAppStore.getState().reorderCategory(voiceCategory!.id, designCategory!.id);

    const reorderedCategories = useAppStore.getState().categoriesBySpaceId[space.id];
    const designIndex = reorderedCategories.findIndex((category) => category.id === designCategory!.id);
    const voiceIndex = reorderedCategories.findIndex((category) => category.id === voiceCategory!.id);

    expect(voiceIndex).toBeLessThan(designIndex);

    const movedRooms = useAppStore.getState().rooms;
    expect(movedRooms.find((room) => room.id === "r_design")?.category).toBe(designCategory!.id);
    expect(movedRooms.find((room) => room.id === "r_voice")?.category).toBe(voiceCategory!.id);

    await useAppStore.getState().deleteCategory(designCategory!.id);
    const afterDeleteRooms = useAppStore.getState().rooms;
    expect(afterDeleteRooms.find((room) => room.id === "r_design")?.category).toBe("channels");
  });

  it("keeps channel order stable after reload-style selectSpace", async () => {
    const store = useAppStore.getState();
    await store.createCategory("build-pipe");
    const createdCategory = useAppStore
      .getState()
      .categoriesBySpaceId[space.id]
      .find((category) => category.name === "build-pipe");

    expect(createdCategory).toBeDefined();
    await useAppStore.getState().moveRoomToCategory("r_voice", createdCategory!.id);
    await useAppStore.getState().moveRoomToCategory("r_design", createdCategory!.id);
    await useAppStore.getState().reorderRoom("r_voice", "r_design", createdCategory!.id);

    const beforeReloadOrder = useAppStore
      .getState()
      .rooms.filter((room) => room.category === createdCategory!.id && room.type !== "dm")
      .map((room) => room.id);

    useAppStore.getState().selectSpace(space.id);

    const afterReloadOrder = useAppStore
      .getState()
      .rooms.filter((room) => room.category === createdCategory!.id && room.type !== "dm")
      .map((room) => room.id);

    expect(afterReloadOrder).toEqual(beforeReloadOrder);
  });

  it("normalizes and persists server settings in local fallback mode", async () => {
    const input: ServerSettings = {
      version: 1,
      overview: {
        description: "Fray build community",
        guidelines: "Be kind, ship often"
      },
      roles: {
        adminLevel: 120,
        moderatorLevel: 55,
        defaultLevel: -4,
        definitions: [
          {
            id: "ops",
            name: "Ops",
            color: "#123456",
            powerLevel: 55,
            permissions: {
              manageChannels: true,
              invite: true
            }
          },
          {
            id: "ops",
            name: "Duplicate",
            color: "#ffffff",
            powerLevel: 10
          }
        ],
        memberRoleIds: {
          "@me:example.com": ["ops", "missing-role"]
        }
      },
      invites: {
        linkExpiryHours: 400,
        requireApproval: true,
        allowGuestInvites: false
      },
      moderation: {
        safetyLevel: "strict",
        blockUnknownMedia: true,
        auditLogRetentionDays: 3
      }
    };

    await useAppStore.getState().saveServerSettings(space.id, input);
    const saved = useAppStore.getState().serverSettingsBySpaceId[space.id];
    expect(saved.roles.adminLevel).toBe(100);
    expect(saved.roles.defaultLevel).toBe(0);
    expect(saved.roles.definitions).toHaveLength(1);
    expect(saved.roles.definitions?.[0]).toEqual(
      expect.objectContaining({
        id: "ops",
        permissions: {
          manageChannels: true,
          invite: true
        }
      })
    );
    expect(saved.roles.memberRoleIds).toEqual({
      "@me:example.com": ["ops"]
    });
    expect(saved.invites.linkExpiryHours).toBe(168);
    expect(saved.moderation.auditLogRetentionDays).toBe(7);
    expect(saved.moderation.safetyLevel).toBe("strict");

    useAppStore.getState().selectSpace(space.id);
    const afterReload = useAppStore.getState().serverSettingsBySpaceId[space.id];
    expect(afterReload).toEqual(saved);
  });
});
