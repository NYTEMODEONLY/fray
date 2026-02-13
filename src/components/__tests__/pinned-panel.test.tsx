import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Message, User } from "../../types";
import { PinnedPanel } from "../PinnedPanel";

describe("pinned panel", () => {
  it("jumps to the selected pinned message", async () => {
    const user = userEvent.setup();
    const onJump = vi.fn();

    const pinned: Message[] = [
      {
        id: "$event1",
        roomId: "!room:example.com",
        authorId: "@ava:example.com",
        body: "Pinned note",
        timestamp: Date.now(),
        reactions: [],
        pinned: true
      }
    ];

    const users: User[] = [
      { id: "@ava:example.com", name: "ava", avatar: "A", status: "online", roles: ["Member"] }
    ];

    render(
      <PinnedPanel
        pinned={pinned}
        users={users}
        onJump={onJump}
        onClose={() => undefined}
      />
    );

    await user.click(screen.getByRole("button", { name: "Jump" }));
    expect(onJump).toHaveBeenCalledWith("$event1");
  });
});
