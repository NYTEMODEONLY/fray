import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NotificationTray } from "../NotificationTray";

describe("Phase 9.5 notification tray", () => {
  it("renders update CTA and routes action callback", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const onAction = vi.fn();

    render(
      <NotificationTray
        notifications={[
          {
            id: "n_update",
            title: "Update available",
            body: "Fray 0.2.0 is available.",
            timestamp: Date.now(),
            action: { id: "install-update", label: "Update now" }
          }
        ]}
        onDismiss={onDismiss}
        onAction={onAction}
      />
    );

    await user.click(screen.getByRole("button", { name: "Update now" }));
    expect(onAction).toHaveBeenCalledWith("n_update", "install-update");

    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledWith("n_update");
  });
});
