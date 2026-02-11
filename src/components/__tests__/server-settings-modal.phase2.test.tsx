import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Category, Room, ServerSettings, Space, User } from "../../types";
import { ServerSettingsModal } from "../ServerSettingsModal";

const space: Space = { id: "s_fray", name: "Fray HQ", icon: "F" };

const rooms: Room[] = [
  {
    id: "r_general",
    spaceId: "s_fray",
    name: "general",
    type: "text",
    category: "community",
    sortOrder: 0,
    unreadCount: 0
  },
  {
    id: "r_voice",
    spaceId: "s_fray",
    name: "hangout",
    type: "voice",
    category: "voice",
    sortOrder: 0,
    unreadCount: 0
  }
];

const categories: Category[] = [
  { id: "channels", name: "Channels", order: 0 },
  { id: "community", name: "Community", order: 1 },
  { id: "voice", name: "Voice", order: 2 }
];

const users: User[] = [
  { id: "@me:example.com", name: "me", avatar: "M", status: "online", roles: ["Admin"] },
  { id: "@ava:example.com", name: "ava", avatar: "A", status: "online", roles: ["Member"] }
];

const settings: ServerSettings = {
  version: 1,
  overview: { description: "Core build server", guidelines: "Ship daily." },
  roles: { adminLevel: 100, moderatorLevel: 50, defaultLevel: 0 },
  invites: { linkExpiryHours: 24, requireApproval: false, allowGuestInvites: true },
  moderation: { safetyLevel: "members_only", blockUnknownMedia: false, auditLogRetentionDays: 30 }
};

describe("Phase 2 server settings modal", () => {
  it("saves invite settings from the Invites tab", async () => {
    const user = userEvent.setup();
    const onSaveSettings = vi.fn().mockResolvedValue(undefined);

    render(
      <ServerSettingsModal
        space={space}
        rooms={rooms}
        categories={categories}
        settings={settings}
        permissionOverrides={{ version: 1, categories: {}, rooms: {} }}
        moderationAudit={[]}
        canManageChannels={true}
        users={users}
        activeTab="invites"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
        onRenameSpace={vi.fn().mockResolvedValue(undefined)}
        onSaveSettings={onSaveSettings}
        onSetCategoryPermissionRule={vi.fn().mockResolvedValue(undefined)}
        onSetRoomPermissionRule={vi.fn().mockResolvedValue(undefined)}
        onCreateCategory={vi.fn().mockResolvedValue(undefined)}
        onRenameCategory={vi.fn().mockResolvedValue(undefined)}
        onDeleteCategory={vi.fn().mockResolvedValue(undefined)}
        onMoveCategoryByStep={vi.fn().mockResolvedValue(undefined)}
        onReorderCategory={vi.fn().mockResolvedValue(undefined)}
        onMoveRoomByStep={vi.fn().mockResolvedValue(undefined)}
        onMoveRoomToCategory={vi.fn().mockResolvedValue(undefined)}
        onReorderRoom={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const expiryInput = screen.getByLabelText("Link Expiry (Hours)");
    await user.clear(expiryInput);
    await user.type(expiryInput, "72");
    await user.click(screen.getByLabelText(/require moderator approval/i));
    await user.click(screen.getByLabelText(/allow guests to create invite links/i));
    await user.click(screen.getByRole("button", { name: "Save Invite Settings" }));

    expect(onSaveSettings).toHaveBeenCalledTimes(1);
    expect(onSaveSettings).toHaveBeenCalledWith({
      ...settings,
      invites: {
        linkExpiryHours: 72,
        requireApproval: true,
        allowGuestInvites: false
      }
    });
  });

  it("wires channel/category management controls in the Channels tab", async () => {
    const user = userEvent.setup();
    const onCreateCategory = vi.fn().mockResolvedValue(undefined);
    const onMoveCategoryByStep = vi.fn().mockResolvedValue(undefined);
    const onMoveRoomByStep = vi.fn().mockResolvedValue(undefined);

    render(
      <ServerSettingsModal
        space={space}
        rooms={rooms}
        categories={categories}
        settings={settings}
        permissionOverrides={{ version: 1, categories: {}, rooms: {} }}
        moderationAudit={[]}
        canManageChannels={true}
        users={users}
        activeTab="channels"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
        onRenameSpace={vi.fn().mockResolvedValue(undefined)}
        onSaveSettings={vi.fn().mockResolvedValue(undefined)}
        onSetCategoryPermissionRule={vi.fn().mockResolvedValue(undefined)}
        onSetRoomPermissionRule={vi.fn().mockResolvedValue(undefined)}
        onCreateCategory={onCreateCategory}
        onRenameCategory={vi.fn().mockResolvedValue(undefined)}
        onDeleteCategory={vi.fn().mockResolvedValue(undefined)}
        onMoveCategoryByStep={onMoveCategoryByStep}
        onReorderCategory={vi.fn().mockResolvedValue(undefined)}
        onMoveRoomByStep={onMoveRoomByStep}
        onMoveRoomToCategory={vi.fn().mockResolvedValue(undefined)}
        onReorderRoom={vi.fn().mockResolvedValue(undefined)}
      />
    );

    await user.type(screen.getByPlaceholderText("new-category"), "ops");
    await user.click(screen.getByRole("button", { name: "Add Category" }));
    const upButtons = screen.getAllByRole("button", { name: "↑" });
    const downButtons = screen.getAllByRole("button", { name: "↓" });
    await user.click(upButtons[0]);
    await user.click(downButtons[0]);
    await user.click(upButtons[upButtons.length - 1]);
    await user.click(downButtons[downButtons.length - 1]);

    expect(onCreateCategory).toHaveBeenCalledWith("ops");
    expect(onMoveCategoryByStep).toHaveBeenCalled();
    expect(onMoveRoomByStep).toHaveBeenCalled();
  });

  it("renders moderation audit feed details", () => {
    render(
      <ServerSettingsModal
        space={space}
        rooms={rooms}
        categories={categories}
        settings={settings}
        permissionOverrides={{ version: 1, categories: {}, rooms: {} }}
        moderationAudit={[
          {
            id: "audit-1",
            action: "message.redact",
            actorId: "@me:example.com",
            target: "@ava:example.com:$event-1",
            timestamp: 1700000000000,
            sourceEventId: "$event-1"
          }
        ]}
        canManageChannels={true}
        users={users}
        activeTab="moderation"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
        onRenameSpace={vi.fn().mockResolvedValue(undefined)}
        onSaveSettings={vi.fn().mockResolvedValue(undefined)}
        onSetCategoryPermissionRule={vi.fn().mockResolvedValue(undefined)}
        onSetRoomPermissionRule={vi.fn().mockResolvedValue(undefined)}
        onCreateCategory={vi.fn().mockResolvedValue(undefined)}
        onRenameCategory={vi.fn().mockResolvedValue(undefined)}
        onDeleteCategory={vi.fn().mockResolvedValue(undefined)}
        onMoveCategoryByStep={vi.fn().mockResolvedValue(undefined)}
        onReorderCategory={vi.fn().mockResolvedValue(undefined)}
        onMoveRoomByStep={vi.fn().mockResolvedValue(undefined)}
        onMoveRoomToCategory={vi.fn().mockResolvedValue(undefined)}
        onReorderRoom={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByText("message.redact")).toBeInTheDocument();
    expect(screen.getByText("@ava:example.com:$event-1")).toBeInTheDocument();
    expect(screen.getByText("@me:example.com")).toBeInTheDocument();
    expect(screen.getByText("$event-1")).toBeInTheDocument();
  });
});
