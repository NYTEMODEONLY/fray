import { describe, expect, it } from "vitest";
import { buildPermissionSnapshot, canRedactMessage, parsePowerLevels } from "../permissionService";

const roleSettings = {
  adminLevel: 100,
  moderatorLevel: 50,
  defaultLevel: 0
};

const basePowerLevels = parsePowerLevels({
  users_default: 0,
  users: {
    "@owner:example.com": 100,
    "@mod:example.com": 50,
    "@member:example.com": 0
  },
  events_default: 0,
  events: {
    "m.room.pinned_events": 50,
    "m.reaction": 0,
    "m.room.message": 0
  },
  invite: 0,
  redact: 50,
  state_default: 50
});

describe("Phase 3 permission service", () => {
  it("derives owner/mod/member/guest permissions from power levels + membership", () => {
    const owner = buildPermissionSnapshot({
      userId: "@owner:example.com",
      membership: "join",
      powerLevels: basePowerLevels,
      roleSettings
    });
    const moderator = buildPermissionSnapshot({
      userId: "@mod:example.com",
      membership: "join",
      powerLevels: basePowerLevels,
      roleSettings
    });
    const member = buildPermissionSnapshot({
      userId: "@member:example.com",
      membership: "join",
      powerLevels: basePowerLevels,
      roleSettings
    });
    const guest = buildPermissionSnapshot({
      userId: "@guest:example.com",
      membership: "leave",
      powerLevels: basePowerLevels,
      roleSettings
    });

    expect(owner.role).toBe("owner");
    expect(owner.actions).toEqual({
      send: true,
      react: true,
      pin: true,
      redact: true,
      invite: true,
      manageChannels: true
    });

    expect(moderator.role).toBe("moderator");
    expect(moderator.actions.redact).toBe(true);
    expect(moderator.actions.manageChannels).toBe(true);

    expect(member.role).toBe("member");
    expect(member.actions.send).toBe(true);
    expect(member.actions.react).toBe(true);
    expect(member.actions.pin).toBe(false);
    expect(member.actions.redact).toBe(false);
    expect(member.actions.manageChannels).toBe(false);

    expect(guest.role).toBe("guest");
    expect(guest.actions.send).toBe(false);
    expect(guest.actions.invite).toBe(false);
  });

  it("applies category inheritance and room deny overrides", () => {
    const snapshot = buildPermissionSnapshot({
      userId: "@mod:example.com",
      membership: "join",
      powerLevels: basePowerLevels,
      roleSettings,
      categoryRules: {
        send: "allow",
        pin: "allow"
      },
      roomRules: {
        pin: "deny"
      }
    });

    expect(snapshot.actions.send).toBe(true);
    expect(snapshot.actions.pin).toBe(false);
  });

  it("allows own-message redaction for members but blocks redacting others", () => {
    const member = buildPermissionSnapshot({
      userId: "@member:example.com",
      membership: "join",
      powerLevels: basePowerLevels,
      roleSettings
    });

    expect(canRedactMessage(member, "@member:example.com", "@member:example.com")).toBe(true);
    expect(canRedactMessage(member, "@other:example.com", "@member:example.com")).toBe(false);
  });
});
