# Discord-Familiar Overhaul Architecture

Date: 2026-02-11

## Decision Summary

Three approaches were evaluated:

1. Quick patch pass on current UI.
- Pros: fastest.
- Cons: high regression risk, inconsistent UX, weak long-term maintainability.

2. Full rewrite.
- Pros: clean slate.
- Cons: highest delivery risk, breaks existing Matrix compatibility paths, long validation cycle.

3. Phased capability overhaul on the existing Matrix client shell.
- Pros: highest quality with controlled risk, keeps Matrix behavior intact, supports incremental verification.
- Cons: requires careful sequencing and migration discipline.

Selected approach: **#3 phased capability overhaul**.

## Scope Boundaries

- Keep Matrix protocol compatibility as the source of truth for messages, membership, room state, and moderation events.
- Add Discord-familiar interaction patterns only where they do not conflict with Matrix semantics.
- Persist server/channel IA state through Matrix room state events:
  - `com.fray.space_layout` for categories and channel ordering.
  - `com.fray.server_settings` for server settings surface defaults.
- Deliver in phases with verification gates per phase (unit/component tests + build checks).

## Non-Goals

- No protocol fork and no proprietary backend requirement.
- No one-shot UI rewrite.
- No client-only permission model that diverges from Matrix power-level auth rules.

## Current Phase Mapping

- Phase 1: UX reliability blockers (send behavior, scrolling/pagination, panel responsiveness, hover actions, dead controls).
- Phase 2: Information architecture and server settings surface (categories, ordering, settings tabs).
- Phase 3: Permissions and admin/moderation capability.
- Phase 4: Messaging polish (grouping, unread affordances, thread/reaction/reply flow, in-room search).
- Phase 5: User settings, onboarding, and discoverability (command palette + shortcuts).
- Phase 6: Quality gates, CI workflow, local-only metrics reporting, and rollout checklist.
- Phase 7: Discord-familiar visual parity pass (layout refinement, icon library migration, profile/avatar UX polish, call/control placement refinement).

## Phase 7 Implementation Notes

- Replaced ad-hoc emoji/text glyph controls with `lucide-react` icons in primary shell interactions.
- Normalized icon hitboxes and visual hierarchy to reduce uneven button feel and improve consistency.
- Moved voice/video controls into the right utility stack to keep text-channel typing flow uncluttered.
- Added profile customization controls (display name, About Me, avatar upload/remove) and persisted preferences.
- Added Matrix-compatible profile sync fallback for display name/avatar updates when connected.

## Risks and Mitigations

- State sync drift across clients.
  - Mitigation: matrix-backed state events + store hydration on `selectSpace` + verification tests.
- Permission confusion between UI roles and Matrix power levels.
  - Mitigation: phase 3 `PermissionService` mapped directly to `m.room.power_levels`.
- Incremental UI complexity.
  - Mitigation: small state/action surfaces with focused automated tests.
