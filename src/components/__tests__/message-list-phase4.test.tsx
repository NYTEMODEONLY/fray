import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PermissionSnapshot } from "../../services/permissionService";
import { Message, User } from "../../types";
import { MessageList } from "../MessageList";

const users: User[] = [
  { id: "@me:example.com", name: "me", avatar: "M", status: "online", roles: ["Member"] },
  { id: "@ava:example.com", name: "ava", avatar: "A", status: "online", roles: ["Member"] }
];

const permissionSnapshot: PermissionSnapshot = {
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

const messages: Message[] = [
  {
    id: "$m1",
    roomId: "!room:example.com",
    authorId: "@ava:example.com",
    body: "first",
    timestamp: new Date("2026-02-09T10:00:00.000Z").getTime(),
    reactions: []
  },
  {
    id: "$m2",
    roomId: "!room:example.com",
    authorId: "@ava:example.com",
    body: "second in group",
    timestamp: new Date("2026-02-09T10:02:00.000Z").getTime(),
    reactions: []
  },
  {
    id: "$m3",
    roomId: "!room:example.com",
    authorId: "@me:example.com",
    body: "searchable payload",
    timestamp: new Date("2026-02-10T10:00:00.000Z").getTime(),
    reactions: []
  }
];

describe("Phase 4 message list UX", () => {
  it("renders grouped messages, separators, and thread unread indicator", () => {
    const { container } = render(
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
        canRedactMessage={() => false}
        onLoadOlder={vi.fn().mockResolvedValue(undefined)}
        isLoadingHistory={false}
        canLoadMoreHistory={false}
        searchQuery=""
        searchFilter="all"
        searchResultIds={[]}
        activeSearchResultId={null}
        focusMessageId={null}
        onFocusHandled={vi.fn()}
        threadSummaryByRootId={{ $m1: { totalReplies: 3, unreadReplies: 2 } }}
        unreadCount={1}
        roomLastReadTs={new Date("2026-02-09T10:05:00.000Z").getTime()}
        onJumpToLatest={vi.fn()}
      />
    );

    expect(container.querySelectorAll(".message-day-separator").length).toBe(2);
    expect(container.querySelector(".message.grouped")).toBeTruthy();
    expect(container.querySelector(".message-unread-separator")).toBeTruthy();
    expect(screen.getByRole("button", { name: "3 replies · 2 new" })).toBeInTheDocument();
  });

  it("supports quick reply, reaction picker, and jump-to-latest affordance", async () => {
    const user = userEvent.setup();
    const onQuickReply = vi.fn();
    const onReact = vi.fn();
    const onJumpToLatest = vi.fn();
    const { container } = render(
      <MessageList
        messages={messages}
        users={users}
        meId="@me:example.com"
        meName="me"
        messageDensity="cozy"
        permissionSnapshot={permissionSnapshot}
        onReact={onReact}
        onReply={vi.fn()}
        onQuickReply={onQuickReply}
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
        onFocusHandled={vi.fn()}
        threadSummaryByRootId={{}}
        unreadCount={5}
        roomLastReadTs={0}
        onJumpToLatest={onJumpToLatest}
      />
    );

    await user.click(screen.getAllByRole("button", { name: "Message actions" })[0]);
    await user.click(screen.getAllByRole("button", { name: "Quick Reply" })[0]);
    expect(onQuickReply).toHaveBeenCalledWith("$m1");

    await user.click(screen.getAllByRole("button", { name: "Message actions" })[0]);
    await user.click(screen.getAllByRole("button", { name: "Add reaction" })[0]);
    await user.click(screen.getAllByRole("button", { name: "🔥" })[0]);
    expect(onReact).toHaveBeenCalledWith("$m1", "🔥");

    const list = container.querySelector(".message-list") as HTMLDivElement;
    Object.defineProperty(list, "scrollTop", { value: 0, writable: true, configurable: true });
    Object.defineProperty(list, "scrollHeight", { value: 2200, configurable: true });
    Object.defineProperty(list, "clientHeight", { value: 280, configurable: true });
    fireEvent.scroll(list);

    await user.click(screen.getByRole("button", { name: "Jump to latest (5)" }));
    expect(onJumpToLatest).toHaveBeenCalledTimes(1);
  });

  it("marks active search targets in the timeline", () => {
    render(
      <MessageList
        messages={messages}
        users={users}
        meId="@me:example.com"
        meName="me"
        messageDensity="compact"
        permissionSnapshot={permissionSnapshot}
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
        searchQuery="payload"
        searchFilter="all"
        searchResultIds={["$m3"]}
        activeSearchResultId="$m3"
        focusMessageId={null}
        onFocusHandled={vi.fn()}
        threadSummaryByRootId={{}}
        unreadCount={0}
        roomLastReadTs={0}
        onJumpToLatest={vi.fn()}
      />
    );

    const targetMessage = screen.getByText("searchable payload").closest("article");
    expect(targetMessage).toHaveClass("search-active");
  });
});
