import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MessageComposer } from "../MessageComposer";
import { ThreadPanel } from "../ThreadPanel";
import { Message, User } from "../../types";

const users: User[] = [
  { id: "@me:example.com", name: "me", avatar: "M", status: "online", roles: ["Admin"] },
  { id: "@ava:example.com", name: "ava", avatar: "A", status: "online", roles: ["Member"] }
];

const rootMessage: Message = {
  id: "$root",
  roomId: "!room:example.com",
  authorId: "@ava:example.com",
  body: "root",
  timestamp: Date.now(),
  reactions: []
};

describe("Phase 1 composer behavior", () => {
  it("sends plain text with Enter and clears input", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<MessageComposer replyToId={null} onClearReply={() => undefined} onSend={onSend} />);

    const input = screen.getByPlaceholderText("Message");
    await user.type(input, "hello world{enter}");

    expect(onSend).toHaveBeenCalledWith({ body: "hello world", attachments: [] });
    expect(input).toHaveValue("");
  });

  it("creates multiline text with Shift+Enter and does not send", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<MessageComposer replyToId={null} onClearReply={() => undefined} onSend={onSend} />);

    const input = screen.getByPlaceholderText("Message");
    await user.type(input, "line one{shift>}{enter}{/shift}line two");

    expect(onSend).not.toHaveBeenCalled();
    expect(input).toHaveValue("line one\nline two");
  });

  it("supports Ctrl/Cmd+Enter send mode when enter-to-send is disabled", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(
      <MessageComposer
        replyToId={null}
        onClearReply={() => undefined}
        onSend={onSend}
        enterToSend={false}
      />
    );

    const input = screen.getByPlaceholderText("Message");
    await user.type(input, "draft{enter}");
    expect(onSend).not.toHaveBeenCalled();
    expect(input).toHaveValue("draft\n");

    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });
    expect(onSend).toHaveBeenCalledWith({ body: "draft", attachments: [] });
  });

  it("sends attachment-only messages", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    const { container } = render(
      <MessageComposer replyToId={null} onClearReply={() => undefined} onSend={onSend} />
    );

    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    const fileInput = container.querySelector("input[type='file']");
    expect(fileInput).toBeTruthy();
    await user.upload(fileInput as HTMLInputElement, file);
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend.mock.calls[0]?.[0]?.body).toBe("(attachment)");
    expect(onSend.mock.calls[0]?.[0]?.attachments?.[0]?.name).toBe("notes.txt");
  });

  it("does not send while IME composition is active", () => {
    const onSend = vi.fn();
    render(<MessageComposer replyToId={null} onClearReply={() => undefined} onSend={onSend} />);

    const input = screen.getByPlaceholderText("Message");
    fireEvent.change(input, { target: { value: "typing" } });
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(onSend).not.toHaveBeenCalled();

    fireEvent.compositionEnd(input);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("shows reply mode banner and supports thread send behavior", async () => {
    const user = userEvent.setup();
    const onClearReply = vi.fn();
    const onThreadSend = vi.fn();

    render(
      <>
        <MessageComposer replyToId="$reply" onClearReply={onClearReply} onSend={() => undefined} />
        <ThreadPanel
          rootMessage={rootMessage}
          threadMessages={[]}
          users={users}
          unreadReplies={0}
          onJumpToRoot={() => undefined}
          onSend={onThreadSend}
          enterToSend={true}
          onClose={() => undefined}
        />
      </>
    );

    expect(screen.getByText("Replying to message $rep")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onClearReply).toHaveBeenCalledTimes(1);

    const threadInput = screen.getByPlaceholderText("Reply in thread");
    await user.type(threadInput, "thread hello{enter}");
    expect(onThreadSend).toHaveBeenCalledWith("thread hello");
  });
});
