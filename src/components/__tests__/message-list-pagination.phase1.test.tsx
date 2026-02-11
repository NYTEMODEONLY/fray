import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessageList } from "../MessageList";
import { Message, User } from "../../types";
import { PermissionSnapshot } from "../../services/permissionService";

const users: User[] = [
  { id: "@me:example.com", name: "me", avatar: "M", status: "online", roles: ["Admin"] },
  { id: "@ava:example.com", name: "ava", avatar: "A", status: "online", roles: ["Member"] }
];

const createMessages = (count: number): Message[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `$event-${index}`,
    roomId: "!room:example.com",
    authorId: "@ava:example.com",
    body: `message ${index}`,
    timestamp: Date.now() - index * 1000,
    reactions: []
  }));

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
  it(
    "renders long histories and requests older messages near top",
    () => {
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
    Object.defineProperty(list, "scrollTop", { value: 0, writable: true, configurable: true });
    Object.defineProperty(list, "scrollHeight", { value: 3000, configurable: true });
    Object.defineProperty(list, "clientHeight", { value: 700, configurable: true });
    fireEvent.scroll(list);
    expect(onLoadOlder).toHaveBeenCalledTimes(1);
    },
    10000
  );

  it(
    "restores scroll position after prepend and blocks loading when disabled",
    () => {
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
    let height = 1200;
    Object.defineProperty(list, "scrollHeight", {
      get: () => height,
      configurable: true
    });
    Object.defineProperty(list, "scrollTop", { value: 0, writable: true, configurable: true });
    Object.defineProperty(list, "clientHeight", { value: 700, configurable: true });

    fireEvent.scroll(list);
    expect(onLoadOlder).toHaveBeenCalledTimes(1);

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

    height = 1600;
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

    expect(list.scrollTop).toBe(400);

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

    list.scrollTop = 0;
    fireEvent.scroll(list);
    expect(onLoadOlder).not.toHaveBeenCalled();
    },
    10000
  );
});
