import { describe, expect, it } from "vitest";
import { useAppStore } from "../appStore";

describe("Phase 1 store stability", () => {
  it("keeps member-panel toggle stable across 20 toggles", () => {
    const initial = useAppStore.getState().showMembers;

    for (let index = 0; index < 20; index += 1) {
      useAppStore.getState().toggleMembers();
    }

    expect(useAppStore.getState().showMembers).toBe(initial);
    useAppStore.setState({ showMembers: initial });
  });
});
