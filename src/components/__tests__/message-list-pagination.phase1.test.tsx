import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessageList } from "../MessageList";
import { Message, User } from "../../types";
import { PermissionSnapshot } from "../../services/permissionService";

const users: User[] = [
  { id: "@me:example.com", name: "me", avatar: "M", status: "online", roles: ["Admin"] },
  { id: "@ava:example.com", name: "ava", avatar: "A", status: "online", roles: ["Member"] }
];

const BASE_TS = 1_700_000_000_000;

const createMessages = (count: number): Message[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `$event-${index}`,
    roomId: "!room:example.com",
    authorId: "@ava:example.com",
    body: `message ${index}`,
    timestamp: BASE_TS - index * 1000,
    reactions: []
  }));

const mockScrollGeometry = (
  list: HTMLDivElement,
  options: {
    initialTop: number;
    initialHeight: number;
    initialClientHeight: number;
  }
) => {
  let scrollTop = options.initialTop;
  let scrollHeight = options.initialHeight;
  let clientHeight = options.initialClientHeight;

  Object.defineProperty(list, "scrollTop", {
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = value;
    },
    configurable: true
  });
  Object.defineProperty(list, "scrollHeight", {
    get: () => scrollHeight,
    configurable: true
  });
  Object.defineProperty(list, "clientHeight", {
    get: () => clientHeight,
    configurable: true
  });

  return {
    setScrollTop: (value: number) => {
      scrollTop = value;
    },
    setScrollHeight: (value: number) => {
      scrollHeight = value;
    },
    setClientHeight: (value: number) => {
      clientHeight = value;
    },
    getScrollTop: () => scrollTop
  };
};

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

describe("Phase 1 message list history pagination", () => {
  it("renders long histories and requests older messages near top", async () => {
    const onLoadOlder = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <MessageList
        messages={createMessages(180)}
        users={users}
        meId="@me:example.com"
        meName="me"
        messageDensity="cozy"
        permissionSnapshot={fullPermissionSnapshot}
        onReact={() => undefined}
        onReply={() => undefined}
        onQuickReply={() => undefined}
        onThread={() => undefined}
        onPin={() => undefined}
        onRedact={() => undefined}
        onCopyLink={() => undefined}
        canRedactMessage={() => true}
        onLoadOlder={onLoadOlder}
        isLoadingHistory={false}
        canLoadMoreHistory={true}
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

    expect(container.querySelectorAll("article.message")).toHaveLength(180);

    const list = container.querySelector(".message-list") as HTMLDivElement;
    mockScrollGeometry(list, {
      initialTop: 0,
      initialHeight: 3000,
      initialClientHeight: 700
    });

    fireEvent.scroll(list);
    await waitFor(() => expect(onLoadOlder).toHaveBeenCalledTimes(1));
  }, 15000);

  it("restores scroll position after prepend and blocks loading when disabled", async () => {
    const onLoadOlder = vi.fn().mockResolvedValue(undefined);
    const { container, rerender } = render(
      <MessageList
        messages={createMessages(30)}
        users={users}
        meId="@me:example.com"
        meName="me"
        messageDensity="cozy"
        permissionSnapshot={fullPermissionSnapshot}
        onReact={() => undefined}
        onReply={() => undefined}
        onQuickReply={() => undefined}
        onThread={() => undefined}
        onPin={() => undefined}
        onRedact={() => undefined}
        onCopyLink={() => undefined}
        canRedactMessage={() => true}
        onLoadOlder={onLoadOlder}
        isLoadingHistory={false}
        canLoadMoreHistory={true}
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

    const list = container.querySelector(".message-list") as HTMLDivElement;
    const geometry = mockScrollGeometry(list, {
      initialTop: 0,
      initialHeight: 1200,
      initialClientHeight: 700
    });

    fireEvent.scroll(list);
    await waitFor(() => expect(onLoadOlder).toHaveBeenCalledTimes(1));

    rerender(
      <MessageList
        messages={createMessages(30)}
        users={users}
        meId="@me:example.com"
        meName="me"
        messageDensity="cozy"
        permissionSnapshot={fullPermissionSnapshot}
        onReact={() => undefined}
        onReply={() => undefined}
        onQuickReply={() => undefined}
        onThread={() => undefined}
        onPin={() => undefined}
        onRedact={() => undefined}
        onCopyLink={() => undefined}
        canRedactMessage={() => true}
        onLoadOlder={onLoadOlder}
        isLoadingHistory={true}
        canLoadMoreHistory={true}
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

    geometry.setScrollHeight(1600);
    rerender(
      <MessageList
        messages={createMessages(45)}
        users={users}
        meId="@me:example.com"
        meName="me"
        messageDensity="cozy"
        permissionSnapshot={fullPermissionSnapshot}
        onReact={() => undefined}
        onReply={() => undefined}
        onQuickReply={() => undefined}
        onThread={() => undefined}
        onPin={() => undefined}
        onRedact={() => undefined}
        onCopyLink={() => undefined}
        canRedactMessage={() => true}
        onLoadOlder={onLoadOlder}
        isLoadingHistory={false}
        canLoadMoreHistory={true}
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

    await waitFor(() => expect(geometry.getScrollTop()).toBe(400));

    onLoadOlder.mockClear();
    rerender(
      <MessageList
        messages={createMessages(45)}
        users={users}
        meId="@me:example.com"
        meName="me"
        messageDensity="cozy"
        permissionSnapshot={fullPermissionSnapshot}
        onReact={() => undefined}
        onReply={() => undefined}
        onQuickReply={() => undefined}
        onThread={() => undefined}
        onPin={() => undefined}
        onRedact={() => undefined}
        onCopyLink={() => undefined}
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

    geometry.setScrollTop(0);
    fireEvent.scroll(list);
    expect(onLoadOlder).not.toHaveBeenCalled();
  }, 15000);
});
