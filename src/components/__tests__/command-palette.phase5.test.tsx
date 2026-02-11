import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CommandPalette } from "../CommandPalette";
import { Room, Space } from "../../types";

const spaces: Space[] = [
  { id: "s_fray", name: "Fray HQ", icon: "F" },
  { id: "s_synth", name: "Synth", icon: "S" }
];

const rooms: Room[] = [
  {
    id: "r_general",
    spaceId: "s_fray",
    name: "general",
    type: "text",
    category: "channels",
    unreadCount: 0
  },
  {
    id: "r_labs",
    spaceId: "s_synth",
    name: "labs",
    type: "text",
    category: "channels",
    unreadCount: 0
  }
];

describe("Phase 5 command palette", () => {
  it("filters and executes room switches", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSelectSpace = vi.fn();
    const onSelectRoom = vi.fn();

    render(
      <CommandPalette
        isOpen={true}
        spaces={spaces}
        rooms={rooms}
        currentSpaceId="s_fray"
        currentRoomId="r_general"
        onClose={onClose}
        onSelectSpace={onSelectSpace}
        onSelectRoom={onSelectRoom}
        onOpenUserSettings={vi.fn()}
        onOpenServerSettings={vi.fn()}
        onToggleMembers={vi.fn()}
        onTogglePins={vi.fn()}
        onJumpToLatest={vi.fn()}
      />
    );

    await user.type(screen.getByPlaceholderText("Search channels, servers, and commands..."), "labs");
    const labsButton = screen.getByText("#labs").closest("button");
    expect(labsButton).toBeTruthy();
    await user.click(labsButton as HTMLButtonElement);

    expect(onSelectSpace).toHaveBeenCalledWith("s_synth");
    expect(onSelectRoom).toHaveBeenCalledWith("r_labs");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("supports keyboard navigation and escape", () => {
    const onClose = vi.fn();
    const onToggleMembers = vi.fn();
    render(
      <CommandPalette
        isOpen={true}
        spaces={spaces}
        rooms={rooms}
        currentSpaceId="s_fray"
        currentRoomId="r_general"
        onClose={onClose}
        onSelectSpace={vi.fn()}
        onSelectRoom={vi.fn()}
        onOpenUserSettings={vi.fn()}
        onOpenServerSettings={vi.fn()}
        onToggleMembers={onToggleMembers}
        onTogglePins={vi.fn()}
        onJumpToLatest={vi.fn()}
      />
    );

    const search = screen.getByPlaceholderText("Search channels, servers, and commands...");
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onToggleMembers).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(search, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
