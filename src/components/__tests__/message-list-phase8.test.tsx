import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PermissionSnapshot } from "../../services/permissionService";
import { Message, User } from "../../types";
import { MessageList } from "../MessageList";

const users: User[] = [
  { id: "@me:example.com", name: "me", avatar: "M", status: "online", roles: ["Admin"] },
  { id: "@ava:example.com", name: "ava", avatar: "A", status: "online", roles: ["Member"] }
];

const permissionSnapshot: PermissionSnapshot = {
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

afterEach(() => {
  vi.useRealTimers();
});

describe("Phase 8 message timestamp and context actions", () => {
  it("renders relative + absolute timestamps", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-11T12:00:00.000Z"));

    const messages: Message[] = [
      {
        id: "$event1",
        roomId: "!room:example.com",
        authorId: "@ava:example.com",
        body: "hello timeline",
        timestamp: new Date("2026-02-10T09:00:00.000Z").getTime(),
        reactions: []
      }
    ];

    render(
      <MessageList
        messages={messages}
        users={users}
        meId="@me:example.com"
        meName="me"
        messageDensity="cozy"
        permissionSnapshot={permissionSnapshot}
        onReact={vi.fn()}
        onReply={vi.fn()}
        onQuickReply={vi.fn()}
        onThread={vi.fn()}
        onPin={vi.fn()}
        onRedact={vi.fn()}
        onCopyLink={vi.fn()}
        canRedactMessage={() => true}
        onLoadOlder={vi.fn().mockResolvedValue(undefined)}
        isLoadingHistory={false}
        canLoadMoreHistory={false}
        searchQuery=""
        searchFilter="all"
        searchResultIds={[]}
        activeSearchResultId={null}
        focusMessageId={null}
        onFocusHandled={vi.fn()}
        threadSummaryByRootId={{}}
        unreadCount={0}
        roomLastReadTs={0}
        onJumpToLatest={vi.fn()}
      />
    );

    expect(screen.getByText(/Yesterday at/i)).toBeInTheDocument();
    expect(screen.getByText("1d ago")).toBeInTheDocument();
    expect(screen.getByText("Yesterday")).toBeInTheDocument();
  });

  it("opens message right-click actions and executes copy link", async () => {
    const user = userEvent.setup();
    const onCopyLink = vi.fn();
    const messages: Message[] = [
      {
        id: "$event1",
        roomId: "!room:example.com",
        authorId: "@ava:example.com",
        body: "right click me",
        timestamp: Date.now(),
        reactions: []
      }
    ];

    render(
      <MessageList
        messages={messages}
        users={users}
        meId="@me:example.com"
        meName="me"
        messageDensity="cozy"
        permissionSnapshot={permissionSnapshot}
        onReact={vi.fn()}
        onReply={vi.fn()}
        onQuickReply={vi.fn()}
        onThread={vi.fn()}
        onPin={vi.fn()}
        onRedact={vi.fn()}
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
        onFocusHandled={vi.fn()}
        threadSummaryByRootId={{}}
        unreadCount={0}
        roomLastReadTs={0}
        onJumpToLatest={vi.fn()}
      />
    );

    const article = screen.getByText("right click me").closest("article");
    expect(article).toBeTruthy();
    fireEvent.contextMenu(article!);

    const contextMenu = document.querySelector(".context-menu");
    expect(contextMenu).toBeTruthy();
    await user.click(within(contextMenu as HTMLElement).getByRole("button", { name: "Copy Link" }));
    expect(onCopyLink).toHaveBeenCalledWith("$event1");
  });
});
