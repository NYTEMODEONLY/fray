import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Category, Room, ServerSettings, Space, User } from "../../types";
import { fetchServerHealthSnapshot } from "../../services/serverHealthService";
import { ServerSettingsModal } from "../ServerSettingsModal";

vi.mock("../../services/serverHealthService", () => ({
  fetchServerHealthSnapshot: vi.fn()
}));

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
  roles: { adminLevel: 100, moderatorLevel: 50, defaultLevel: 0, definitions: [], memberRoleIds: {} },
  invites: { linkExpiryHours: 24, requireApproval: false, allowGuestInvites: true },
  moderation: { safetyLevel: "members_only", blockUnknownMedia: false, auditLogRetentionDays: 30 }
};

describe("Phase 2 server settings modal", () => {
  const mockedFetchServerHealthSnapshot = vi.mocked(fetchServerHealthSnapshot);

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
        canDeleteChannels={true}
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
      roles: {
        ...settings.roles,
        definitions: [],
        memberRoleIds: {}
      },
      invites: {
        linkExpiryHours: 72,
        requireApproval: true,
        allowGuestInvites: false
      }
    });
  });

  it("creates roles and persists role definitions from the Roles tab", async () => {
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
        canDeleteChannels={true}
        users={users}
        activeTab="roles"
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

    await user.type(screen.getByPlaceholderText("new-role"), "Operator");
    await user.clear(screen.getByLabelText("Role power level"));
    await user.type(screen.getByLabelText("Role power level"), "80");
    await user.click(screen.getByRole("button", { name: "Create Role" }));
    await user.click(screen.getByLabelText("Manage Channels"));
    await user.click(screen.getByRole("button", { name: "Save Roles" }));

    expect(onSaveSettings).toHaveBeenCalledTimes(1);
    expect(onSaveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        roles: expect.objectContaining({
          definitions: expect.arrayContaining([
            expect.objectContaining({
              name: "Operator",
              powerLevel: 80,
              permissions: expect.objectContaining({
                manageChannels: true
              })
            })
          ]),
          memberRoleIds: {}
        })
      })
    );
  });

  it("assigns custom roles to members and persists assignments", async () => {
    const user = userEvent.setup();
    const onSaveSettings = vi.fn().mockResolvedValue(undefined);
    const roleAwareSettings: ServerSettings = {
      ...settings,
      roles: {
        ...settings.roles,
        definitions: [{ id: "ops", name: "Operator", color: "#7d8cff", powerLevel: 70 }],
        memberRoleIds: {}
      }
    };

    render(
      <ServerSettingsModal
        space={space}
        rooms={rooms}
        categories={categories}
        settings={roleAwareSettings}
        permissionOverrides={{ version: 1, categories: {}, rooms: {} }}
        moderationAudit={[]}
        canManageChannels={true}
        canDeleteChannels={true}
        users={users}
        activeTab="members"
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

    await user.click(screen.getAllByLabelText("Operator")[0]);
    await user.click(screen.getByRole("button", { name: "Save Member Roles" }));

    expect(onSaveSettings).toHaveBeenCalledTimes(1);
    expect(onSaveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        roles: expect.objectContaining({
          memberRoleIds: {
            "@me:example.com": ["ops"]
          }
        })
      })
    );
  });

  it("assigns members directly from the Roles tab manage-members section", async () => {
    const user = userEvent.setup();
    const onSaveSettings = vi.fn().mockResolvedValue(undefined);
    const roleAwareSettings: ServerSettings = {
      ...settings,
      roles: {
        ...settings.roles,
        definitions: [{ id: "ops", name: "Operator", color: "#7d8cff", powerLevel: 70 }],
        memberRoleIds: {}
      }
    };

    render(
      <ServerSettingsModal
        space={space}
        rooms={rooms}
        categories={categories}
        settings={roleAwareSettings}
        permissionOverrides={{ version: 1, categories: {}, rooms: {} }}
        moderationAudit={[]}
        canManageChannels={true}
        canDeleteChannels={true}
        users={users}
        activeTab="roles"
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

    await user.click(screen.getByLabelText("Assign Operator to me"));
    await user.click(screen.getByRole("button", { name: "Save Roles" }));

    expect(onSaveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        roles: expect.objectContaining({
          memberRoleIds: {
            "@me:example.com": ["ops"]
          }
        })
      })
    );
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
        canDeleteChannels={true}
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

  it("loads infrastructure health metrics in the Health tab", async () => {
    const user = userEvent.setup();
    mockedFetchServerHealthSnapshot.mockReset();
    mockedFetchServerHealthSnapshot.mockResolvedValue({
      captured_at: 1700000000000,
      host: {
        cpu_percent: 37.5,
        load_1m: 0.9,
        load_5m: 0.8,
        load_15m: 0.7,
        uptime_seconds: 5400,
        memory_total_bytes: 8 * 1024 * 1024 * 1024,
        memory_used_bytes: 4 * 1024 * 1024 * 1024,
        memory_available_bytes: 4 * 1024 * 1024 * 1024,
        disk_total_bytes: 100 * 1024 * 1024 * 1024,
        disk_used_bytes: 25 * 1024 * 1024 * 1024,
        disk_available_bytes: 75 * 1024 * 1024 * 1024
      },
      matrix: {
        container: "fray-synapse",
        status: "running",
        health: "healthy",
        version: "1.147.0",
        room_count: 12,
        user_count: 4,
        joined_memberships: 8
      },
      database: {
        container: "fray-postgres",
        status: "running",
        health: "healthy",
        database: "synapse",
        size_bytes: 12345678,
        active_connections: 5
      },
      containers: [
        {
          name: "fray-synapse",
          status: "running",
          health: "healthy",
          cpuPercent: "12.3%",
          memoryPercent: "18.0%",
          memoryUsage: "600MiB / 3.2GiB",
          networkIo: "5kB / 6kB",
          blockIo: "0B / 0B",
          pids: "12"
        }
      ],
      errors: []
    });

    render(
      <ServerSettingsModal
        space={space}
        rooms={rooms}
        categories={categories}
        settings={settings}
        permissionOverrides={{ version: 1, categories: {}, rooms: {} }}
        moderationAudit={[]}
        canManageChannels={true}
        canDeleteChannels={true}
        users={users}
        activeTab="health"
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

    await user.clear(screen.getByLabelText("VPS Host"));
    await user.type(screen.getByLabelText("VPS Host"), "matrix.example.com");
    await user.clear(screen.getByLabelText("SSH User"));
    await user.type(screen.getByLabelText("SSH User"), "root");
    await user.type(screen.getByLabelText("SSH Password (Optional)"), "test-pass-123");
    await user.click(screen.getByLabelText("Auto-refresh every 10 seconds"));
    await user.click(screen.getByRole("button", { name: "Refresh Health" }));

    await waitFor(() => {
      expect(mockedFetchServerHealthSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          host: "matrix.example.com",
          username: "root",
          password: "test-pass-123"
        })
      );
    });

    expect(screen.getByText("Infrastructure Health")).toBeInTheDocument();
    expect(screen.getByText("1.147.0")).toBeInTheDocument();
    expect(screen.getAllByText("running (healthy)").length).toBeGreaterThan(0);
    expect(screen.getByText("fray-synapse")).toBeInTheDocument();
    expect(screen.getByText("12.3%")).toBeInTheDocument();
  });

  it("auto-fills and locks host from matrix base URL by default", async () => {
    mockedFetchServerHealthSnapshot.mockReset();
    window.localStorage.removeItem("fray.server.health.prefs");
    mockedFetchServerHealthSnapshot.mockResolvedValue({
      captured_at: 1700000000000,
      host: {
        cpu_percent: 10,
        load_1m: 0.2,
        load_5m: 0.2,
        load_15m: 0.2,
        uptime_seconds: 1200,
        memory_total_bytes: 1,
        memory_used_bytes: 1,
        memory_available_bytes: 0,
        disk_total_bytes: 1,
        disk_used_bytes: 1,
        disk_available_bytes: 0
      },
      matrix: {
        container: "fray-synapse",
        status: "running",
        health: "healthy"
      },
      database: {
        container: "fray-postgres",
        status: "running",
        health: "healthy",
        database: "synapse"
      },
      containers: [],
      errors: []
    });

    render(
      <ServerSettingsModal
        space={space}
        rooms={rooms}
        categories={categories}
        matrixBaseUrl="https://matrix.example.com"
        settings={settings}
        permissionOverrides={{ version: 1, categories: {}, rooms: {} }}
        moderationAudit={[]}
        canManageChannels={true}
        canDeleteChannels={true}
        users={users}
        activeTab="health"
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

    await waitFor(() => {
      expect(screen.getByLabelText("VPS Host")).toHaveValue("matrix.example.com");
    });
    expect(screen.getByLabelText("VPS Host")).toBeDisabled();
    expect(screen.getByLabelText(/override auto-detected host/i)).toBeInTheDocument();
  });

  it("does not refresh health while editing host fields", async () => {
    const user = userEvent.setup();
    mockedFetchServerHealthSnapshot.mockReset();
    window.localStorage.removeItem("fray.server.health.prefs");
    mockedFetchServerHealthSnapshot.mockResolvedValue({
      captured_at: 1700000000000,
      host: {
        cpu_percent: 10,
        load_1m: 0.2,
        load_5m: 0.2,
        load_15m: 0.2,
        uptime_seconds: 1200,
        memory_total_bytes: 1,
        memory_used_bytes: 1,
        memory_available_bytes: 0,
        disk_total_bytes: 1,
        disk_used_bytes: 1,
        disk_available_bytes: 0
      },
      matrix: {
        container: "fray-synapse",
        status: "running",
        health: "healthy"
      },
      database: {
        container: "fray-postgres",
        status: "running",
        health: "healthy",
        database: "synapse"
      },
      containers: [],
      errors: []
    });

    render(
      <ServerSettingsModal
        space={space}
        rooms={rooms}
        categories={categories}
        settings={settings}
        permissionOverrides={{ version: 1, categories: {}, rooms: {} }}
        moderationAudit={[]}
        canManageChannels={true}
        canDeleteChannels={true}
        users={users}
        activeTab="health"
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

    await user.clear(screen.getByLabelText("VPS Host"));
    await user.type(screen.getByLabelText("VPS Host"), "matrix.example.com");
    await user.clear(screen.getByLabelText("SSH User"));
    await user.type(screen.getByLabelText("SSH User"), "root");

    expect(mockedFetchServerHealthSnapshot).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Refresh Health" }));

    await waitFor(() => {
      expect(mockedFetchServerHealthSnapshot).toHaveBeenCalledTimes(1);
    });
  });

  it("hides health tab when infrastructure access is not allowed", () => {
    render(
      <ServerSettingsModal
        space={space}
        rooms={rooms}
        categories={categories}
        settings={settings}
        permissionOverrides={{ version: 1, categories: {}, rooms: {} }}
        moderationAudit={[]}
        canManageChannels={true}
        canDeleteChannels={true}
        canViewInfrastructureHealth={false}
        users={users}
        activeTab="overview"
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

    expect(screen.queryByRole("button", { name: "Health" })).not.toBeInTheDocument();
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
        canDeleteChannels={true}
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
