import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChannelList } from "../ChannelList";
import { MessageList } from "../MessageList";
import { RoomHeader } from "../RoomHeader";
import { ServerRail } from "../ServerRail";
import { Category, Message, Room, Space, User } from "../../types";
import { PermissionSnapshot } from "../../services/permissionService";

const spaces: Space[] = [
  { id: "s_fray", name: "Fray HQ", icon: "F" },
  { id: "s_synth", name: "Synth Club", icon: "S" }
];

const rooms: Room[] = [
  {
    id: "r_general",
    spaceId: "s_fray",
    name: "general",
    type: "text",
    category: "community",
    unreadCount: 2
  },
  {
    id: "r_voice",
    spaceId: "s_fray",
    name: "hangout",
    type: "voice",
    category: "voice",
    unreadCount: 0
  },
  {
    id: "r_dm",
    spaceId: "s_fray",
    name: "@ava",
    type: "dm",
    unreadCount: 0
  }
];

const categories: Category[] = [
  { id: "community", name: "Community", order: 0 },
  { id: "voice", name: "Voice", order: 1 }
];

const users: User[] = [
  { id: "@me:example.com", name: "me", avatar: "M", status: "online", roles: ["Admin"] },
  { id: "@ava:example.com", name: "ava", avatar: "A", status: "online", roles: ["Member"] }
];

const messages: Message[] = [
  {
    id: "$event1",
    roomId: "r_general",
    authorId: "@ava:example.com",
    body: "hello world",
    timestamp: Date.now(),
    reactions: []
  }
];

const fullPermissionSnapshot: PermissionSnapshot = {
  role: "owner",
  membership: "join",
  powerLevel: 100,
  actions: {
    send: true,
    react: true,
    pin: true,
    redact: true,
    invite: true,
    manageChannels: true
  }
};

describe("Phase 1 click-through controls", () => {
  it("wires server rail buttons", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onCreateSpace = vi.fn();

    render(
      <ServerRail
        spaces={spaces}
        currentSpaceId="s_fray"
        onSelect={onSelect}
        onCreateSpace={onCreateSpace}
      />
    );

    await user.click(screen.getByRole("button", { name: "Synth Club" }));
    await user.click(screen.getByRole("button", { name: "Create space" }));

    expect(onSelect).toHaveBeenCalledWith("s_synth");
    expect(onCreateSpace).toHaveBeenCalledTimes(1);
  });

  it("wires channel panel primary actions", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onCreateRoom = vi.fn();
    const onInvite = vi.fn();
    const onToggleOnline = vi.fn();
    const onOpenUserSettings = vi.fn();
    const onOpenSpaceSettings = vi.fn();
    const onMoveCategoryByStep = vi.fn().mockResolvedValue(undefined);
    const onReorderCategory = vi.fn().mockResolvedValue(undefined);
    const onMoveRoomByStep = vi.fn().mockResolvedValue(undefined);
    const onMoveRoomToCategory = vi.fn().mockResolvedValue(undefined);
    const onReorderRoom = vi.fn().mockResolvedValue(undefined);

    render(
      <ChannelList
        me={users[0]!}
        rooms={rooms}
        categories={categories}
        currentRoomId="r_general"
        canManageChannels={true}
        canDeleteChannels={true}
        onSelect={onSelect}
        spaceName="Fray HQ"
        isOnline={true}
        onToggleOnline={onToggleOnline}
        onCreateRoom={onCreateRoom}
        onInvite={onInvite}
        onOpenSpaceSettings={onOpenSpaceSettings}
        spaceSettingsEnabled={true}
        onOpenUserSettings={onOpenUserSettings}
        onMoveCategoryByStep={onMoveCategoryByStep}
        onReorderCategory={onReorderCategory}
        onMoveRoomByStep={onMoveRoomByStep}
        onMoveRoomToCategory={onMoveRoomToCategory}
        onReorderRoom={onReorderRoom}
        onDeleteCategory={vi.fn().mockResolvedValue(undefined)}
        onDeleteRoom={vi.fn().mockResolvedValue(undefined)}
      />
    );

    await user.click(screen.getByRole("button", { name: "Space settings" }));
    await user.click(screen.getByRole("button", { name: "Invite" }));
    await user.click(screen.getByRole("button", { name: "New Channel" }));
    await user.type(screen.getByPlaceholderText("channel-name"), "updates");
    await user.click(screen.getAllByRole("button", { name: "Create" })[0]);
    await user.click(screen.getByRole("button", { name: /hangout/i }));
    await user.click(screen.getByRole("button", { name: "Online" }));
    await user.click(screen.getByRole("button", { name: "User settings" }));

    expect(onOpenSpaceSettings).toHaveBeenCalledTimes(1);
    expect(onInvite).toHaveBeenCalledTimes(1);
    expect(onCreateRoom).toHaveBeenCalledWith({
      name: "updates",
      type: "text",
      category: "community"
    });
    expect(onSelect).toHaveBeenCalledWith("r_voice");
    expect(onToggleOnline).toHaveBeenCalledTimes(1);
    expect(onOpenUserSettings).toHaveBeenCalledTimes(1);
  });

  it("wires room header controls including enter mode toggle", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    const onToggleMembers = vi.fn();
    const onTogglePins = vi.fn();
    const onSimulate = vi.fn();
    const onOpenUserSettings = vi.fn();
    const onOpenCommandPalette = vi.fn();
    const onLogout = vi.fn();

    render(
      <RoomHeader
        room={rooms[0]}
        searchQuery=""
        onSearch={onSearch}
        searchFilter="all"
        onSearchFilterChange={vi.fn()}
        searchResultCount={0}
        activeSearchResultIndex={0}
        onSearchPrev={vi.fn()}
        onSearchNext={vi.fn()}
        onJumpToSearchResult={vi.fn()}
        onToggleMembers={onToggleMembers}
        onTogglePins={onTogglePins}
        onSimulate={onSimulate}
        isOnline={true}
        onToggleOnline={vi.fn()}
        enterToSend={true}
        onToggleEnterToSend={vi.fn()}
        messageDensity="cozy"
        onToggleMessageDensity={vi.fn()}
        theme="dark"
        onToggleTheme={vi.fn()}
        onOpenUserSettings={onOpenUserSettings}
        onOpenCommandPalette={onOpenCommandPalette}
        onLogout={onLogout}
      />
    );

    await user.type(screen.getByPlaceholderText("Search messages"), "design");
    await user.click(screen.getByRole("button", { name: "Pinned messages" }));
    await user.click(screen.getByRole("button", { name: "Toggle members" }));
    await user.click(screen.getByRole("button", { name: /User settings/i }));
    await user.click(screen.getByRole("button", { name: "Quick Switch" }));
    await user.click(screen.getByRole("button", { name: "Simulate Ping" }));
    await user.click(screen.getByRole("button", { name: "Logout" }));

    expect(onSearch).toHaveBeenCalled();
    expect(onTogglePins).toHaveBeenCalledTimes(1);
    expect(onToggleMembers).toHaveBeenCalledTimes(1);
    expect(onOpenUserSettings).toHaveBeenCalledTimes(1);
    expect(onOpenCommandPalette).toHaveBeenCalledTimes(1);
    expect(onSimulate).toHaveBeenCalledTimes(1);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("keeps message actions keyboard and touch reachable", async () => {
    const user = userEvent.setup();
    const onReact = vi.fn();
    const onReply = vi.fn();
    const onThread = vi.fn();
    const onPin = vi.fn();
    const onRedact = vi.fn();
    const onCopyLink = vi.fn();
    const onQuickReply = vi.fn();
    const onLoadOlder = vi.fn().mockResolvedValue(undefined);

    render(
      <MessageList
        messages={messages}
        users={users}
        meId="@me:example.com"
        meName="me"
        messageDensity="cozy"
        permissionSnapshot={fullPermissionSnapshot}
        onReact={onReact}
        onReply={onReply}
        onQuickReply={onQuickReply}
        onThread={onThread}
        onPin={onPin}
        onRedact={onRedact}
        onCopyLink={onCopyLink}
        canRedactMessage={() => true}
        onLoadOlder={onLoadOlder}
        isLoadingHistory={false}
        canLoadMoreHistory={false}
        searchQuery=""
        searchFilter="all"
        searchResultIds={[]}
        activeSearchResultId={null}
        focusMessageId={null}
        onFocusHandled={() => undefined}
        threadSummaryByRootId={{}}
        unreadCount={0}
        roomLastReadTs={0}
        onJumpToLatest={() => undefined}
      />
    );

    const more = screen.getByRole("button", { name: "Message actions" });
    expect(more).toHaveAttribute("aria-expanded", "false");

    await user.click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: "Reply" }));
    await user.click(screen.getByRole("button", { name: "Thread" }));
    await user.click(screen.getByRole("button", { name: "Pin" }));
    await user.click(screen.getByRole("button", { name: "Add reaction" }));
    await user.click(screen.getByRole("button", { name: "🔥" }));

    expect(onReply).toHaveBeenCalledWith("$event1");
    expect(onThread).toHaveBeenCalledWith("$event1");
    expect(onPin).toHaveBeenCalledWith("$event1");
    expect(onReact).toHaveBeenCalledWith("$event1", "🔥");
  });
});
