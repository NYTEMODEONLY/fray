# Discord Roles/Permissions Deep Dive + Matrix Mapping for Fray

_Date: 2026-02-11_

## 1) How Discord roles and permissions work

### Core model
- Every member has the `@everyone` role as baseline permissions.
- Additional roles are additive at the server level (grants combine).
- Role order (hierarchy) matters for moderation/management operations:
  - you cannot manage roles higher than your top role,
  - you cannot moderate users with an equal/higher top role,
  - owner/admin semantics sit at the top.

### Channel permission resolution (Discord mental model)
Discord resolves channel permissions with overwrite precedence:
1. start from server/base permissions,
2. apply `@everyone` channel overwrite,
3. apply role overwrites (deny then allow),
4. apply member-specific overwrite (deny then allow).

Net effect: explicit channel deny beats inherited allow, and targeted allow can re-grant after earlier steps depending on overwrite scope.

### Role management flow
- Roles are created in server settings.
- Each role has display attributes (name/color/icon style where applicable).
- Role membership assignment is managed per-role and per-member.
- Permissions are edited per-role and can be overridden per-channel.

## 2) Matrix authorization model constraints

Matrix does not have a native Discord-like role object. Authorization is primarily:
- room membership state (`join/invite/...`),
- `m.room.power_levels` thresholds for actions/events,
- state event auth rules.

So a Discord-like role system in Fray must be represented as application state, then mapped to Matrix power levels and/or enforced in Fray UX where Matrix primitives do not directly match Discord behavior.

## 3) Fray persistence model (Matrix-compatible)

Fray stores server-role state in Matrix room state events so it survives reload/reconnect:
- `com.fray.server_settings`
  - `roles.definitions[]` (role id, name, color, power level, action grants)
  - `roles.memberRoleIds` (user -> role id list)
- `com.fray.permission_overrides`
  - category and room-level allow/deny/inherit overrides used by Fray permission resolution.

Related server state remains persisted via:
- `com.fray.space_layout` (categories/channel ordering)
- `com.fray.server_meta` (server label in no-`m.space` deployments)

## 4) Permission evaluation used in Fray

Current Fray evaluation pipeline:
1. read Matrix membership + Matrix room power level data,
2. compute effective user power level from max(Matrix PL, assigned role PL),
3. apply role-level action grants from assigned roles,
4. apply category/room overrides (`deny` > `allow` > inherit),
5. expose resolved actions to UI gates (send/react/pin/redact/invite/manage channels).

This keeps Matrix compatibility while enabling Discord-familiar role configuration behavior.

## 5) What was implemented in this pass

- Direct role assignment in **Roles** tab (not only Members tab).
- Per-role permission toggles with descriptions.
- Role list + role detail editing panel (display, permissions, manage members).
- Persistent role permissions and assignments through `com.fray.server_settings`.
- Permission engine now honors role permission grants in addition to Matrix PL.
- Added tests for role creation, role permission persistence, role assignment from Roles tab, and permission resolution behavior.

## 6) Production gaps to close next

To reach fuller Discord parity before production:
- Add explicit role hierarchy ordering controls and enforce management constraints (cannot edit roles >= own highest role).
- Add role-scoped channel overwrites (role + member overwrite tables, not only global category/room rules).
- Add dedicated `Manage Roles` capability gate distinct from `Manage Channels`.
- Expand permission taxonomy (view channel, manage messages, manage roles, mention permissions, etc.) and map each to Matrix-capable enforcement paths.
- Add server-wide member source (union/authoritative directory for all server members), not only current-room-derived membership snapshots.
- Add integration tests with second Matrix client session to verify cross-client persistence and eventual consistency for role edits and assignments.

## Sources

- Discord Developer Docs: Permissions and overwrite resolution
  - https://discord.com/developers/docs/topics/permissions
- Discord Creator Portal: Permissions hierarchy explainer
  - https://discord.com/creators/permissions-on-discord-discord
- Discord Support: Setting up permissions FAQ
  - https://support.discord.com/hc/en-us/articles/206029707-Setting-Up-Permissions-FAQ
- Matrix Spec: `m.room.power_levels`
  - https://spec.matrix.org/latest/client-server-api/#mroompower_levels
