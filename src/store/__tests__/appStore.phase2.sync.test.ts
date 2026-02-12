import { beforeEach, describe, expect, it } from "vitest";
import { EventType } from "matrix-js-sdk";
import { ServerSettings } from "../../types";
import { useAppStore } from "../appStore";

const SPACE_ID = "s_matrix";
const SPACE_LAYOUT_EVENT = "com.fray.space_layout";
const SERVER_SETTINGS_EVENT = "com.fray.server_settings";
const ROOM_TYPE_EVENT = "com.fray.room_type";

interface MatrixHarness {
  client: object;
  setLayout: (nextLayout: unknown) => void;
  setServerSettings: (nextSettings: unknown) => void;
}

const defaultServerSettings = (): ServerSettings => ({
  version: 1,
  overview: {
    description: "",
    guidelines: ""
  },
  roles: {
    adminLevel: 100,
    moderatorLevel: 50,
    defaultLevel: 0
  },
  invites: {
    linkExpiryHours: 24,
    requireApproval: false,
    allowGuestInvites: true
  },
  moderation: {
    safetyLevel: "members_only",
    blockUnknownMedia: false,
    auditLogRetentionDays: 30
  }
});

const baseLayout = () => ({
  version: 1,
  categories: [
    { id: "channels", name: "Channels", order: 0 },
    { id: "ops", name: "Ops", order: 1 }
  ],
  rooms: {
    r_alpha: { categoryId: "channels", order: 0 },
    r_beta: { categoryId: "ops", order: 0 }
  }
});

const createMatrixHarness = (): MatrixHarness => {
  let layoutContent: unknown = baseLayout();
  let settingsContent: unknown = defaultServerSettings();
  const childRoomIds = ["r_alpha", "r_beta"];

  const channelRoom = (roomId: string, name: string) => ({
    roomId,
    name,
    tags: {},
    getType: () => "m.room",
    getMyMembership: () => "join",
    getDefaultRoomName: () => name,
    getUnreadNotificationCount: () => 0,
    getLiveTimeline: () => ({ getEvents: () => [] }),
    getJoinedMembers: () => [
      { userId: "@tester:example.com", name: "tester", powerLevel: 100 }
    ],
    currentState: {
      getStateEvents: (type: string) => {
        if (type === ROOM_TYPE_EVENT) {
          return { getContent: () => ({ type: "text" }) };
        }
        return undefined;
      }
    }
  });

  const rooms = [
    {
      roomId: SPACE_ID,
      name: "Matrix Space",
      getType: () => "m.space",
      currentState: {
        getStateEvents: (type: string, stateKey?: string) => {
          if (type === EventType.SpaceChild && stateKey === undefined) {
            return childRoomIds.map((roomId) => ({
              getStateKey: () => roomId,
              getContent: () => ({})
            }));
          }
          if (type === SPACE_LAYOUT_EVENT && stateKey === "") {
            return { getContent: () => layoutContent };
          }
          if (type === SERVER_SETTINGS_EVENT && stateKey === "") {
            return { getContent: () => settingsContent };
          }
          return undefined;
        }
      }
    },
    channelRoom("r_alpha", "alpha"),
    channelRoom("r_beta", "beta")
  ];

  const roomIndex = new Map<string, (typeof rooms)[number]>(rooms.map((room) => [room.roomId, room]));

  const client = {
    getRooms: () => rooms,
    getRoom: (roomId: string) => roomIndex.get(roomId),
    getAccountData: () => undefined,
    getUserId: () => "@tester:example.com",
    sendStateEvent: async (_roomId: string, eventType: string, content: Record<string, unknown>) => {
      if (eventType === SPACE_LAYOUT_EVENT) {
        layoutContent = content;
      }
      if (eventType === SERVER_SETTINGS_EVENT) {
        settingsContent = content;
      }
    }
  };

  return {
    client,
    setLayout: (nextLayout) => {
      layoutContent = nextLayout;
    },
    setServerSettings: (nextSettings) => {
      settingsContent = nextSettings;
    }
  };
};

describe("Phase 2 matrix sync/reconnect verification", () => {
  let harness: MatrixHarness;

  beforeEach(() => {
    harness = createMatrixHarness();
    useAppStore.setState((state) => ({
      ...state,
      matrixClient: harness.client as never,
      spaces: [{ id: SPACE_ID, name: "Matrix Space", icon: "M" }],
      currentSpaceId: SPACE_ID,
      currentRoomId: "",
      rooms: [],
      categoriesBySpaceId: {},
      spaceLayoutsBySpaceId: {},
      serverSettingsBySpaceId: {},
      notifications: []
    }));
  });

  it("reloads category and channel ordering from shared Matrix state after reconnect", async () => {
    const state = useAppStore.getState();

    state.selectSpace(SPACE_ID);
    expect(useAppStore.getState().rooms.map((room) => room.id)).toEqual(["r_alpha", "r_beta"]);
    expect(
      useAppStore
        .getState()
        .categoriesBySpaceId[SPACE_ID]
        .map((category) => category.id)
    ).toEqual(["channels", "ops"]);

    // Simulate a second client writing a new layout ordering.
    harness.setLayout({
      version: 1,
      categories: [
        { id: "channels", name: "Channels", order: 0 },
        { id: "ops", name: "Ops", order: 1 }
      ],
      rooms: {
        r_alpha: { categoryId: "ops", order: 0 },
        r_beta: { categoryId: "ops", order: 1 }
      }
    });

    // Simulate reconnect/local cache reset then re-hydration from live Matrix room state.
    useAppStore.setState((current) => ({
      ...current,
      rooms: [],
      categoriesBySpaceId: {},
      spaceLayoutsBySpaceId: {}
    }));

    useAppStore.getState().selectSpace(SPACE_ID);

    const hydratedRooms = useAppStore
      .getState()
      .rooms.filter((room) => room.type !== "dm")
      .map((room) => ({ id: room.id, category: room.category }));
    expect(hydratedRooms).toEqual([
      { id: "r_alpha", category: "ops" },
      { id: "r_beta", category: "ops" }
    ]);

    const hydratedCategories = useAppStore.getState().categoriesBySpaceId[SPACE_ID].map((category) => category.id);
    expect(hydratedCategories).toEqual(["channels", "ops"]);
  });

  it("hydrates updated server settings from live Matrix state after reconnect", async () => {
    harness.setServerSettings({
      ...defaultServerSettings(),
      overview: { description: "Initial Description", guidelines: "Initial Guidelines" }
    });

    useAppStore.getState().selectSpace(SPACE_ID);
    expect(useAppStore.getState().serverSettingsBySpaceId[SPACE_ID].overview.description).toBe(
      "Initial Description"
    );

    // Simulate remote update from another logged-in session.
    harness.setServerSettings({
      ...defaultServerSettings(),
      overview: { description: "Updated by Other Client", guidelines: "Keep it civil" },
      moderation: {
        safetyLevel: "strict",
        blockUnknownMedia: true,
        auditLogRetentionDays: 45
      }
    });

    useAppStore.setState((current) => ({
      ...current,
      serverSettingsBySpaceId: {}
    }));

    useAppStore.getState().selectSpace(SPACE_ID);
    const synced = useAppStore.getState().serverSettingsBySpaceId[SPACE_ID];
    expect(synced.overview.description).toBe("Updated by Other Client");
    expect(synced.moderation.safetyLevel).toBe("strict");
    expect(synced.moderation.blockUnknownMedia).toBe(true);
  });
});
