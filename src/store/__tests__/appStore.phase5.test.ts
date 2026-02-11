import { beforeEach, describe, expect, it } from "vitest";
import { Message, Room, Space } from "../../types";
import { useAppStore } from "../appStore";

const space: Space = { id: "s_phase5", name: "Phase 5", icon: "P" };
const rooms: Room[] = [
  {
    id: "r_general",
    spaceId: "s_phase5",
    name: "general",
    type: "text",
    category: "channels",
    unreadCount: 0
  }
];

const messages: Message[] = [
  {
    id: "$old",
    roomId: "r_general",
    authorId: "@ava:example.com",
    body: "welcome",
    timestamp: 1000,
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
    onboardingStep: 0,
    notifications: []
  }));
};

describe("Phase 5 preference and onboarding persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
  });

  it("persists user preference updates to local storage", () => {
    const store = useAppStore.getState();
    store.setTheme("light");
    store.setNotificationsEnabled(false);
    store.setMentionsOnlyNotifications(true);
    store.setKeybindsEnabled(false);
    store.setComposerSpellcheck(false);
    store.setReducedMotion(true);
    store.setHighContrast(true);
    store.setFontScale(1.2);

    const raw = localStorage.getItem("fray.preferences");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed.theme).toBe("light");
    expect(parsed.notificationsEnabled).toBe(false);
    expect(parsed.mentionsOnlyNotifications).toBe(true);
    expect(parsed.keybindsEnabled).toBe(false);
    expect(parsed.composerSpellcheck).toBe(false);
    expect(parsed.reducedMotion).toBe(true);
    expect(parsed.highContrast).toBe(true);
    expect(parsed.fontScale).toBe(1.2);
  });

  it("marks onboarding complete on explicit completion", () => {
    useAppStore.getState().completeOnboarding();
    expect(useAppStore.getState().onboardingStep).toBeNull();
    const raw = localStorage.getItem("fray.preferences");
    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed.onboardingCompleted).toBe(true);
  });

  it("auto-completes onboarding after first sent message", async () => {
    await useAppStore.getState().sendMessage({ body: "first hello" });
    expect(useAppStore.getState().onboardingStep).toBeNull();
    const raw = localStorage.getItem("fray.preferences");
    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed.onboardingCompleted).toBe(true);
  });
});
