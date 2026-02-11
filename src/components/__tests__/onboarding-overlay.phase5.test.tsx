import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OnboardingOverlay } from "../OnboardingOverlay";

describe("Phase 5 onboarding overlay", () => {
  it("guides welcome, recommendations, and first message actions", async () => {
    const user = userEvent.setup();
    const onOpenWelcome = vi.fn();
    const onOpenChannel = vi.fn();
    const onFocusComposer = vi.fn();
    const onComplete = vi.fn();

    render(
      <OnboardingOverlay
        step={0}
        spaceName="Fray HQ"
        welcomeChannelName="welcome"
        recommendedChannels={[
          { id: "r_general", name: "general" },
          { id: "r_build", name: "build-log" }
        ]}
        recommendedRoles={["Moderator", "Artist"]}
        onOpenWelcome={onOpenWelcome}
        onOpenChannel={onOpenChannel}
        onFocusComposer={onFocusComposer}
        onComplete={onComplete}
      />
    );

    await user.click(screen.getByRole("button", { name: "Take Me to Welcome" }));
    expect(onOpenWelcome).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "#general" }));
    expect(onOpenChannel).toHaveBeenCalledWith("r_general");

    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Focus Composer" }));
    expect(onFocusComposer).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Skip Onboarding" }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
