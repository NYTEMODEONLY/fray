import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "../appStore";

const resetStore = () => {
  useAppStore.setState((state) => {
    const me = {
      id: "u_me",
      name: "nyte",
      avatar: "N",
      status: "online" as const,
      roles: ["Admin"]
    };
    return {
      ...state,
      matrixClient: null,
      profileDisplayName: "",
      profileAbout: "",
      profileAvatarDataUrl: null,
      me,
      users: [
        me,
        { id: "u_ava", name: "ava", avatar: "A", status: "online" as const, roles: ["Member"] }
      ]
    };
  });
};

describe("Phase 7 profile preferences", () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
  });

  it("updates display name for self user and persists preference", () => {
    useAppStore.getState().setProfileDisplayName("nytemode");

    const state = useAppStore.getState();
    expect(state.profileDisplayName).toBe("nytemode");
    expect(state.me.name).toBe("nytemode");
    expect(state.me.avatar).toBe("N");
    expect(state.users.find((user) => user.id === "u_me")?.name).toBe("nytemode");

    const raw = localStorage.getItem("fray.preferences");
    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed.profileDisplayName).toBe("nytemode");
  });

  it("sets and removes profile avatar data url", () => {
    const avatar = "data:image/png;base64,abc";
    useAppStore.getState().setProfileAvatarDataUrl(avatar);

    let state = useAppStore.getState();
    expect(state.profileAvatarDataUrl).toBe(avatar);
    expect(state.me.avatarUrl).toBe(avatar);
    expect(state.users.find((user) => user.id === "u_me")?.avatarUrl).toBe(avatar);

    useAppStore.getState().setProfileAvatarDataUrl(null);
    state = useAppStore.getState();
    expect(state.profileAvatarDataUrl).toBeNull();
    expect(state.me.avatarUrl).toBeUndefined();
  });

  it("stores about me text with max length", () => {
    const longBio = "a".repeat(260);
    useAppStore.getState().setProfileAbout(longBio);

    const state = useAppStore.getState();
    expect(state.profileAbout.length).toBe(190);

    const raw = localStorage.getItem("fray.preferences");
    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed.profileAbout.length).toBe(190);
  });
});
