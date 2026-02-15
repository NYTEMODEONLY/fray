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
        onCreateCategory={vi.fn().mockResolvedValue(undefined)}
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
        onCreateCategory={vi.fn().mockResolvedValue(undefined)}
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
        onCreateCategory={vi.fn().mockResolvedValue(undefined)}
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

  it("creates video channels and categories from the panel", async () => {
    const user = userEvent.setup();
    const onCreateRoom = vi.fn();
    const onCreateCategory = vi.fn().mockResolvedValue(undefined);

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
        onCreateRoom={onCreateRoom}
        onCreateCategory={onCreateCategory}
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
        onDeleteRoom={vi.fn().mockResolvedValue(undefined)}
      />
    );

    await user.click(screen.getByRole("button", { name: "New Channel" }));
    await user.type(screen.getByPlaceholderText("channel-name"), "war-room");
    await user.selectOptions(screen.getByLabelText("Type"), "video");
    await user.selectOptions(screen.getByLabelText("Category"), "voice");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(onCreateRoom).toHaveBeenCalledWith({
      name: "war-room",
      type: "video",
      category: "voice"
    });

    await user.click(screen.getByRole("button", { name: "New Channel" }));
    await user.type(screen.getByPlaceholderText("new-category"), "Ops");
    await user.click(screen.getByRole("button", { name: "Add Category" }));
    expect(onCreateCategory).toHaveBeenCalledWith("Ops");
  });

  it("supports dragging channels back to the default Channels category", () => {
    const onMoveRoomToCategory = vi.fn().mockResolvedValue(undefined);
    const categoriesWithDefault: Category[] = [
      { id: "channels", name: "Channels", order: 0 },
      ...categories
    ];

    render(
      <ChannelList
        me={me}
        rooms={rooms}
        categories={categoriesWithDefault}
        currentRoomId="r_general"
        canManageChannels={true}
        canDeleteChannels={true}
        onSelect={vi.fn()}
        spaceName="Fray HQ"
        isOnline={true}
        onToggleOnline={vi.fn()}
        onCreateRoom={vi.fn()}
        onCreateCategory={vi.fn().mockResolvedValue(undefined)}
        onInvite={vi.fn()}
        onOpenSpaceSettings={vi.fn()}
        spaceSettingsEnabled={true}
        onOpenUserSettings={vi.fn()}
        onMoveCategoryByStep={vi.fn().mockResolvedValue(undefined)}
        onReorderCategory={vi.fn().mockResolvedValue(undefined)}
        onMoveRoomByStep={vi.fn().mockResolvedValue(undefined)}
        onMoveRoomToCategory={onMoveRoomToCategory}
        onReorderRoom={vi.fn().mockResolvedValue(undefined)}
        onDeleteCategory={vi.fn().mockResolvedValue(undefined)}
        onDeleteRoom={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const transfer = createDataTransfer();
    const roomGeneral = screen.getByRole("button", { name: "general" });
    const categoryChannels = screen.getByRole("button", { name: "Channels" });

    fireEvent.dragStart(roomGeneral, { dataTransfer: transfer });
    fireEvent.dragOver(categoryChannels, { dataTransfer: transfer });
    fireEvent.drop(categoryChannels, { dataTransfer: transfer });

    expect(onMoveRoomToCategory).toHaveBeenCalledWith("r_general", "channels");
  });

  it("hides voice/video channel creation options when advanced calls are disabled", async () => {
    const user = userEvent.setup();
    const onCreateRoom = vi.fn();

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
        onCreateRoom={onCreateRoom}
        onCreateCategory={vi.fn().mockResolvedValue(undefined)}
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
        onDeleteRoom={vi.fn().mockResolvedValue(undefined)}
        enableAdvancedCalls={false}
      />
    );

    await user.click(screen.getByRole("button", { name: "New Channel" }));
    const typeSelect = screen.getByLabelText("Type");
    expect(within(typeSelect).queryByRole("option", { name: "Voice" })).toBeNull();
    expect(within(typeSelect).queryByRole("option", { name: "Video" })).toBeNull();

    await user.type(screen.getByPlaceholderText("channel-name"), "text-only");
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(onCreateRoom).toHaveBeenCalledWith({
      name: "text-only",
      type: "text",
      category: "community"
    });
  });
});
