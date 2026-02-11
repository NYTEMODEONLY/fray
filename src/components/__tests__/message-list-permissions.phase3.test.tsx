import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PermissionSnapshot } from "../../services/permissionService";
import { Message, User } from "../../types";
import { MessageList } from "../MessageList";

const users: User[] = [
  { id: "@me:example.com", name: "me", avatar: "M", status: "online", roles: ["Member"] },
  { id: "@ava:example.com", name: "ava", avatar: "A", status: "online", roles: ["Member"] }
];

const messages: Message[] = [
  {
    id: "$event1",
    roomId: "!room:example.com",
    authorId: "@ava:example.com",
    body: "hello",
    timestamp: Date.now(),
    reactions: []
  }
];

const ownerSnapshot: PermissionSnapshot = {
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

const memberSnapshot: PermissionSnapshot = {
  role: "member",
  membership: "join",
  powerLevel: 0,
  actions: {
    send: true,
    react: true,
    pin: false,
    redact: false,
    invite: false,
    manageChannels: false
  }
};

describe("Phase 3 message action permission gating", () => {
  it("hides admin-only actions for members", async () => {
    const user = userEvent.setup();
    render(
      <MessageList
        messages={messages}
        users={users}
        meId="@me:example.com"
        meName="me"
        messageDensity="cozy"
        permissionSnapshot={memberSnapshot}
        onReact={vi.fn()}
        onReply={vi.fn()}
        onQuickReply={vi.fn()}
        onThread={vi.fn()}
        onPin={vi.fn()}
        onRedact={vi.fn()}
        onCopyLink={vi.fn()}
        canRedactMessage={() => false}
        onLoadOlder={vi.fn().mockResolvedValue(undefined)}
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

    await user.click(screen.getByRole("button", { name: "Message actions" }));
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pin" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reply" })).toBeInTheDocument();
  });

  it("allows admins to redact and copy links", async () => {
    const user = userEvent.setup();
    const onRedact = vi.fn();
    const onCopyLink = vi.fn();

    render(
      <MessageList
        messages={messages}
        users={users}
        meId="@me:example.com"
        meName="me"
        messageDensity="cozy"
        permissionSnapshot={ownerSnapshot}
        onReact={vi.fn()}
        onReply={vi.fn()}
        onQuickReply={vi.fn()}
        onThread={vi.fn()}
        onPin={vi.fn()}
        onRedact={onRedact}
        onCopyLink={onCopyLink}
        canRedactMessage={() => true}
        onLoadOlder={vi.fn().mockResolvedValue(undefined)}
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

    await user.click(screen.getByRole("button", { name: "Message actions" }));
    await user.click(screen.getByRole("button", { name: "Copy Link" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(onCopyLink).toHaveBeenCalledWith("$event1");
    expect(onRedact).toHaveBeenCalledWith("$event1");
  });
});
