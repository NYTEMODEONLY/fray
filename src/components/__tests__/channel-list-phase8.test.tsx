import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChannelList } from "../ChannelList";
import { Category, Room, User } from "../../types";

const me: User = {
  id: "@me:example.com",
  name: "me",
  avatar: "M",
  status: "online",
  roles: ["Admin"]
};

const categories: Category[] = [
  { id: "community", name: "Community", order: 0 },
  { id: "voice", name: "Voice", order: 1 }
];

const rooms: Room[] = [
  {
    id: "r_general",
    spaceId: "s_fray",
    name: "general",
    type: "text",
    category: "community",
    unreadCount: 0
  },
  {
    id: "r_voice",
    spaceId: "s_fray",
    name: "hangout",
    type: "voice",
    category: "voice",
    unreadCount: 0
  }
];

const createDataTransfer = () =>
  ({
    effectAllowed: "move",
    dropEffect: "move"
  }) as unknown as DataTransfer;

describe("Phase 8 channel list interactions", () => {
  it("wires drag-and-drop for category reorder and cross-category room move", () => {
    const onReorderCategory = vi.fn().mockResolvedValue(undefined);
    const onMoveRoomToCategory = vi.fn().mockResolvedValue(undefined);

    render(
      <ChannelList
        me={me}
        rooms={rooms}
        categories={categories}
        currentRoomId="r_general"
        canManageChannels={true}
        canDeleteChannels={true}
        onSelect={vi.fn()}
        spaceName="Fray HQ"
        isOnline={true}
        onToggleOnline={vi.fn()}
        onCreateRoom={vi.fn()}
        onInvite={vi.fn()}
        onOpenSpaceSettings={vi.fn()}
        spaceSettingsEnabled={true}
        onOpenUserSettings={vi.fn()}
        onMoveCategoryByStep={vi.fn().mockResolvedValue(undefined)}
        onReorderCategory={onReorderCategory}
        onMoveRoomByStep={vi.fn().mockResolvedValue(undefined)}
        onMoveRoomToCategory={onMoveRoomToCategory}
        onReorderRoom={vi.fn().mockResolvedValue(undefined)}
        onDeleteCategory={vi.fn().mockResolvedValue(undefined)}
        onDeleteRoom={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const transfer = createDataTransfer();
    const categoryVoice = screen.getByRole("button", { name: "Voice" });
    const categoryCommunity = screen.getByRole("button", { name: "Community" });
    const roomGeneral = screen.getByRole("button", { name: "general" });

    fireEvent.dragStart(roomGeneral, { dataTransfer: transfer });
    fireEvent.dragOver(categoryVoice, { dataTransfer: transfer });
    fireEvent.drop(categoryVoice, { dataTransfer: transfer });
    expect(onMoveRoomToCategory).toHaveBeenCalledWith("r_general", "voice");

    fireEvent.dragStart(categoryVoice, { dataTransfer: transfer });
    fireEvent.dragOver(categoryCommunity, { dataTransfer: transfer });
    fireEvent.drop(categoryCommunity, { dataTransfer: transfer });
    expect(onReorderCategory).toHaveBeenCalledWith("voice", "community");
  });

  it("opens channel right-click actions", async () => {
    const user = userEvent.setup();
    const onMoveRoomByStep = vi.fn().mockResolvedValue(undefined);
    const onDeleteRoom = vi.fn().mockResolvedValue(undefined);
    const onDeleteCategory = vi.fn().mockResolvedValue(undefined);

    render(
      <ChannelList
        me={me}
        rooms={rooms}
        categories={categories}
        currentRoomId="r_general"
        canManageChannels={true}
        canDeleteChannels={true}
        onSelect={vi.fn()}
        spaceName="Fray HQ"
        isOnline={true}
        onToggleOnline={vi.fn()}
        onCreateRoom={vi.fn()}
        onInvite={vi.fn()}
        onOpenSpaceSettings={vi.fn()}
        spaceSettingsEnabled={true}
        onOpenUserSettings={vi.fn()}
        onMoveCategoryByStep={vi.fn().mockResolvedValue(undefined)}
        onReorderCategory={vi.fn().mockResolvedValue(undefined)}
        onMoveRoomByStep={onMoveRoomByStep}
        onMoveRoomToCategory={vi.fn().mockResolvedValue(undefined)}
        onReorderRoom={vi.fn().mockResolvedValue(undefined)}
        onDeleteCategory={onDeleteCategory}
        onDeleteRoom={onDeleteRoom}
      />
    );

    fireEvent.contextMenu(screen.getByRole("button", { name: "general" }));
    await user.click(screen.getByRole("button", { name: "Move channel up" }));
    expect(onMoveRoomByStep).toHaveBeenCalledWith("r_general", "up");

    fireEvent.contextMenu(screen.getByRole("button", { name: "general" }));
    await user.click(screen.getByRole("button", { name: "Delete channel" }));
    const roomDeleteDialog = screen.getByRole("dialog", { name: "Delete confirmation" });
    await user.click(within(roomDeleteDialog).getByRole("button", { name: "Delete channel" }));
    expect(onDeleteRoom).toHaveBeenCalledWith("r_general");

    fireEvent.contextMenu(screen.getByRole("button", { name: "Community" }));
    await user.click(screen.getByRole("button", { name: "Delete category" }));
    const categoryDeleteDialog = screen.getByRole("dialog", { name: "Delete confirmation" });
    await user.click(within(categoryDeleteDialog).getByRole("button", { name: "Delete category" }));
    expect(onDeleteCategory).toHaveBeenCalledWith("community");
  });

  it("requires explicit confirmation before deleting", async () => {
    const user = userEvent.setup();
    const onDeleteRoom = vi.fn().mockResolvedValue(undefined);

    render(
      <ChannelList
        me={me}
        rooms={rooms}
        categories={categories}
        currentRoomId="r_general"
        canManageChannels={true}
        canDeleteChannels={true}
        onSelect={vi.fn()}
        spaceName="Fray HQ"
        isOnline={true}
        onToggleOnline={vi.fn()}
        onCreateRoom={vi.fn()}
        onInvite={vi.fn()}
        onOpenSpaceSettings={vi.fn()}
        spaceSettingsEnabled={true}
        onOpenUserSettings={vi.fn()}
        onMoveCategoryByStep={vi.fn().mockResolvedValue(undefined)}
        onReorderCategory={vi.fn().mockResolvedValue(undefined)}
        onMoveRoomByStep={vi.fn().mockResolvedValue(undefined)}
        onMoveRoomToCategory={vi.fn().mockResolvedValue(undefined)}
        onReorderRoom={vi.fn().mockResolvedValue(undefined)}
        onDeleteCategory={vi.fn().mockResolvedValue(undefined)}
        onDeleteRoom={onDeleteRoom}
      />
    );

    fireEvent.contextMenu(screen.getByRole("button", { name: "general" }));
    await user.click(screen.getByRole("button", { name: "Delete channel" }));
    const dialog = screen.getByRole("dialog", { name: "Delete confirmation" });
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(onDeleteRoom).not.toHaveBeenCalled();
  });
});
