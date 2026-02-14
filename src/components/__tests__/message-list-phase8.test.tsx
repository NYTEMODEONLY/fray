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
  it("hides overflow trigger when hover toolbar is available", () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(hover: hover) and (pointer: fine)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    });

    try {
      const messages: Message[] = [
        {
          id: "$event1",
          roomId: "!room:example.com",
          authorId: "@ava:example.com",
          body: "hover actions",
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

      expect(screen.queryByRole("button", { name: "Message actions" })).toBeNull();
    } finally {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: originalMatchMedia
      });
    }
  }, 10000);

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

  it("routes matrix message links through in-app jump handler", async () => {
    const user = userEvent.setup();
    const onOpenMessageLink = vi.fn((href: string) => Boolean(href));
    const messages: Message[] = [
      {
        id: "$event1",
        roomId: "!room:example.com",
        authorId: "@ava:example.com",
        body: "[Jump](https://matrix.to/#/%21room%3Aexample.com/%24event1)",
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
        onOpenMessageLink={onOpenMessageLink}
      />
    );

    await user.click(screen.getByRole("link", { name: "Jump" }));
    expect(onOpenMessageLink).toHaveBeenCalledTimes(1);
    const href = onOpenMessageLink.mock.calls[0]?.[0];
    expect(href).toContain("matrix.to/#/%21room%3Aexample.com/%24event1");
  });

  it("renders system messages without action controls", () => {
    const messages: Message[] = [
      {
        id: "$sys1",
        roomId: "!room:example.com",
        authorId: "@ava:example.com",
        body: "ava joined the room",
        timestamp: Date.now(),
        reactions: [],
        system: true
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

    expect(screen.getByText("System")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Message actions" })).toBeNull();
  });
});
