# Todo

- [x] Reproduce and fix Fray relogin failure (`IndexedDBStore.startup` ordering)
- [x] VERIFY: run build and confirm no TypeScript/runtime bootstrap errors
- [x] Harden VPS Matrix observability (log rotation + diagnostics command)
- [x] VERIFY: confirm container health, diagnostics output, and login endpoint
- [x] Update project docs with deployment runbook + logging standards
- [x] VERIFY: review docs for accuracy/links and ensure changes are commit-ready

## Review
- Fixed Fray Matrix bootstrap order by creating the client first, then calling `IndexedDBStore.startup()`.
- Added fallback to non-persistent store mode if IndexedDB startup fails, preventing hard login failure loops.
- Hardened VPS deployment with Docker log rotation policy and a host-side diagnostics script.
- Verified Matrix versions and login endpoints in HTTP test mode.
- Added deployment runbook and logging guidance docs for repeatable operations.

## Discord-Familiar Client Overhaul Plan (2026-02-11)

### Approach Decision (quality first)

- [x] Compare 3 approaches and lock one in:
  1) quick patch pass, 2) full UI rewrite, 3) phased capability overhaul on current Matrix client.
- [x] Decide on approach 3 (phased capability overhaul): fewer moving parts than rewrite, higher quality than quick fixes, preserves Matrix correctness.
- [x] VERIFY: publish one-page architecture note in `docs/` with scope boundaries and non-goals.

### Phase 1 - Core UX Reliability (must-fix parity blockers)

- [x] Replace all no-op buttons with real actions or remove them (`Space settings`, `Invite`, `Create space`, placeholder actions).
- [x] VERIFY: click-through test for every visible button in all primary layouts (desktop + narrow width), confirm no dead controls.

- [x] Implement Discord-familiar send behavior in composer: `Enter` sends, `Shift+Enter` inserts newline, IME composition safe.
- [x] Add a user preference toggle for send behavior (enter-to-send on by default).
- [x] VERIFY: manual and automated tests for plain text, multiline text, reply mode, thread mode, attachment-only, IME input.

- [x] Fix message timeline scrolling: message pane must scroll independently and remain usable with long history.
- [x] Add upward pagination for older Matrix events when nearing top of message list.
- [x] VERIFY: load >500 events in a room and confirm smooth scroll, no layout jump, no locked scroll container.

- [x] Make member panel truly responsive to open/close so chat panel expands/contracts without empty reserved space.
- [x] VERIFY: toggle members 20+ times and confirm width transitions + stable message composer placement.

- [x] Show message action strip on hover/focus (not always visible) with keyboard-accessible fallback and touch menu fallback.
- [x] VERIFY: hover shows actions, keyboard focus reveals actions, screen reader has reachable controls.

### Phase 1 Verification Log (2026-02-11)

- Added automated verification suite with Vitest + Testing Library:
  - `src/components/__tests__/phase1-clickthrough.test.tsx`
  - `src/components/__tests__/message-composer.phase1.test.tsx`
  - `src/components/__tests__/message-list-pagination.phase1.test.tsx`
  - `src/store/__tests__/appStore.phase1.test.ts`
- Added test tooling/config:
  - `vitest.config.ts`
  - `src/test/setup.ts`
  - `package.json` scripts (`test`, `test:watch`)
- Verification commands run:
  - `npm run test` -> 13 passing tests (4/4 files).
  - `npm run build` -> successful TypeScript + production build.

### Phase 2 - Server and Channel Information Architecture

- [x] Build full server settings surface (Overview, Roles, Members, Channels, Invites, Moderation/Safety) under the space settings entry point.
- [x] VERIFY: all settings tabs load from live Matrix state and persist writes correctly.

- [x] Add real category objects and category CRUD (create, rename, delete, reorder) instead of freeform tag input only.
- [x] Store channel ordering and grouping through Matrix-compatible structures.
- [x] VERIFY: categories/channels stay ordered after reload, sync to another logged-in client, and survive reconnect.

- [x] Implement drag-and-drop reorder for categories and channels with keyboard reorder fallback.
- [x] VERIFY: reorder emits expected state updates and preserves order after hard refresh.

### Phase 2 Verification Log (2026-02-11)

- Added server settings persistence model on Matrix state event `com.fray.server_settings`.
- Added Phase 2 tests:
  - `src/store/__tests__/appStore.phase2.test.ts`
  - `src/store/__tests__/appStore.phase2.sync.test.ts`
  - `src/components/__tests__/server-settings-modal.phase2.test.tsx`
- Added architecture note:
  - `docs/discord-familiar-overhaul-architecture.md`
- Verification commands run:
  - `npm run test` -> 20 passing tests (7/7 files).
  - `npm run build` -> successful TypeScript + production build.

### Phase 3 - Permissions and Admin Capability

- [x] Introduce a `PermissionService` that derives effective permissions from `m.room.power_levels` + membership + room state.
- [x] VERIFY: matrix of role/power scenarios (owner/mod/member/guest) for send, react, pin, redact, invite, manage channels.

- [x] Add admin/mod actions in message UI: delete (redact), pin/unpin, copy link, reply, thread, with permission gating.
- [x] VERIFY: admins can redact any message; members cannot redact others; permission errors handled with clear UI feedback.

- [x] Add channel/category permission editor with inheritance + per-channel override model familiar to Discord users.
- [x] VERIFY: inherited permissions apply correctly and explicit denies override inherited allows.

- [x] Add moderation audit events panel (state changes, role changes, redactions) for server admins.
- [x] VERIFY: action feed shows actor, target, timestamp, and source event id.

### Phase 3 Verification Log (2026-02-11)

- Added permission engine:
  - `src/services/permissionService.ts`
- Added Matrix-backed permission override + moderation audit state events:
  - `com.fray.permission_overrides`
  - `com.fray.audit_log`
- Added Phase 3 tests:
  - `src/services/__tests__/permissionService.phase3.test.ts`
  - `src/components/__tests__/message-list-permissions.phase3.test.tsx`
  - `src/store/__tests__/appStore.phase3.test.ts`
  - moderation feed assertions added in `src/components/__tests__/server-settings-modal.phase2.test.tsx`
- Verification commands run:
  - `npm run test` -> 28 passing tests (10/10 files).
  - `npm run build` -> successful TypeScript + production build.

### Phase 4 - Messaging Experience Polish

- [x] Upgrade message rendering: grouped author blocks, compact mode option, improved timestamp/readability hierarchy.
- [x] VERIFY: component tests for grouped rendering, compact mode, and timestamp/day separator behavior.

- [x] Improve reactions/replies/threads UX: richer emoji picker, quick reply, thread unread indicators, jump-to-thread-root.
- [x] VERIFY: thread/reply/reaction flows work in local mode and pass component/unit test coverage.

- [x] Implement better search UX (room search + filters + result navigation) aligned with Discord mental model.
- [x] VERIFY: search filters + navigation are covered with service/component tests and jump to highlighted result.

- [x] Add unread separator, mention highlight, and jump-to-latest affordance.
- [x] VERIFY: unread marker placement and jump-to-latest behavior are covered with component/store tests.

### Phase 4 Execution Plan (2026-02-11)

- [x] Implement grouped/compact message rendering with day separators and message block grouping by author + time window.
- [x] VERIFY: add component tests covering grouped rendering, compact mode layout class, and timestamp/date separator output.

- [x] Implement richer reaction + reply/thread interactions:
  - add quick emoji picker fallback + quick reply affordance.
  - add thread unread indicator in message list and thread jump-to-root control.
- [x] VERIFY: add UI tests for hover action behavior, emoji picker interaction, quick-reply trigger, and thread unread indicator visibility.

- [x] Implement room search UX upgrades:
  - add in-room search filters (`all`, `mentions`, `has:links`, `from:me`).
  - add result navigation (prev/next) and jump to highlighted result.
- [x] VERIFY: add tests for filter parsing, result counts, navigation wrapping, and highlighted message state.

- [x] Implement unread affordances:
  - unread separator injection based on room read marker.
  - mention-highlight treatment in timeline.
  - jump-to-latest CTA that scrolls to newest message and clears unread marker.
- [x] VERIFY: add store + component tests for unread marker placement after pagination/room switch and jump-to-latest behavior.

### Phase 4 Verification Log (2026-02-11)

- Added message presentation/search service:
  - `src/services/messagePresentationService.ts`
- Added Phase 4 component/store/service tests:
  - `src/components/__tests__/message-list-phase4.test.tsx`
  - `src/services/__tests__/messagePresentationService.phase4.test.ts`
  - `src/store/__tests__/appStore.phase4.test.ts`
- Updated existing tests for new signatures and controls:
  - `src/components/__tests__/phase1-clickthrough.test.tsx`
  - `src/components/__tests__/message-list-pagination.phase1.test.tsx`
  - `src/components/__tests__/message-list-permissions.phase3.test.tsx`
  - `src/components/__tests__/message-composer.phase1.test.tsx`
- Verification commands run:
  - `npm run test` -> 37 passing tests (13/13 files).
  - `npm run build` -> successful TypeScript + production build.

### Phase 5 - Settings, Onboarding, and Discoverability

- [x] Build user settings (appearance, notifications, keybinds, text/input preferences, accessibility).
- [x] VERIFY: settings persist in local preferences and apply live without full app reload.

- [x] Add server onboarding flow (welcome channel, first steps, role/channel recommendations).
- [x] VERIFY: onboarding flow includes welcome jump, recommendations, composer-first-message path, and auto-completes on first send.

- [x] Introduce command palette / quick switcher and baseline keyboard shortcuts.
- [x] VERIFY: users can switch rooms/servers and trigger key actions via palette and keyboard shortcuts.

### Phase 5 Execution Plan (2026-02-11)

- [x] Add persistent user preference model in store for:
  - notifications behavior (enabled + mentions-only)
  - keybind enablement
  - text/input preferences (enter-to-send + spellcheck)
  - accessibility (reduced motion, high contrast, font scale)
  - onboarding completion state.
- [x] VERIFY: add store tests proving preferences persist and onboarding completion persists.

- [x] Build user settings modal with tabs:
  - Appearance, Notifications, Keybinds, Text/Input, Accessibility.
  - connect controls to live app state (no hard reload required).
- [x] VERIFY: add component tests for modal control wiring and live callback behavior.

- [x] Add command palette / quick switcher:
  - searchable space + room navigation
  - action commands (toggle members/pins, open settings, jump to latest).
  - baseline keyboard shortcuts (`Cmd/Ctrl+K`, `Cmd/Ctrl+,`, and panel toggles).
- [x] VERIFY: add tests for palette search, keyboard navigation, and shortcut triggers.

- [x] Upgrade onboarding flow:
  - guided quick-start with welcome channel CTA
  - recommended channels + role hints
  - first-message CTA and completion path.
- [x] VERIFY: add tests that onboarding actions route to welcome/composer and completion is triggered by first message send.

### Phase 5 Verification Log (2026-02-11)

- Added new Phase 5 components:
  - `src/components/UserSettingsModal.tsx`
  - `src/components/CommandPalette.tsx`
- Upgraded onboarding flow:
  - `src/components/OnboardingOverlay.tsx`
- Added persistent preference + onboarding-completion model:
  - `src/store/appStore.ts`
- Wired Phase 5 into app shell and composer/thread settings:
  - `src/App.tsx`
  - `src/components/RoomHeader.tsx`
  - `src/components/MessageComposer.tsx`
  - `src/components/ThreadPanel.tsx`
  - `src/index.css`
- Added Phase 5 tests:
  - `src/components/__tests__/user-settings-modal.phase5.test.tsx`
  - `src/components/__tests__/command-palette.phase5.test.tsx`
  - `src/components/__tests__/onboarding-overlay.phase5.test.tsx`
  - `src/store/__tests__/appStore.phase5.test.ts`
- Verification commands run:
  - `npm run test` -> 44 passing tests (17/17 files).
  - `npm run build` -> successful TypeScript + production build.

### Phase 6 - Quality Gates, Testing, and Rollout

- [x] Add Playwright end-to-end suite for critical flows: login, select space/room, send message, paginate history, toggle panels, moderation action.
- [x] VERIFY: CI runs and passes on every PR touching chat shell/store/components.

- [x] Add unit tests for store reducers/services (permissions, category ordering, unread state, send behavior).
- [x] VERIFY: coverage thresholds set for critical state logic.

- [x] Add telemetry-free product metrics (local-only or self-hosted analytics) for UX outcomes: message send success, dead-click rate, settings completion, moderation action success.
- [x] VERIFY: weekly report generated from test environment demonstrating trend movement.

- [ ] Run staged rollout (internal dogfood -> private alpha -> public beta) with rollback checklist.
- [ ] VERIFY: exit criteria met before each stage promotion.

### Phase 6 Verification Log (2026-02-11)

- Added Phase 6 quality gate infrastructure:
  - `playwright.config.ts`
  - `tests/e2e/chat-shell.phase6.spec.ts`
  - `.github/workflows/chat-quality-gates.yml`
  - `vitest.config.ts` coverage config + test discovery hardening.
- Added local metrics instrumentation/reporting:
  - `src/services/localMetricsService.ts`
  - `scripts/generate-metrics-report.mjs`
  - `metrics/test-environment-events.json`
  - `metrics/weekly-report.md`
- Added supporting test coverage:
  - `src/services/__tests__/localMetricsService.phase6.test.ts`
- Verification commands run:
  - `npm run metrics:report` -> generated `metrics/weekly-report.md`.
  - `npm run test` -> 46 passing tests (18/18 files).
  - `npm run test:coverage` -> passing thresholds (lines/functions/statements >=35, branches >=30).
  - `npm run build` -> successful TypeScript + production build.
  - `npm run test:e2e` -> 2 passing tests (2/2 specs).

### Phase 7 - Discord-Familiar Visual Layout + Profile Avatar

- [x] Restructure app shell controls to Discord-familiar placement:
  - top channel header focused on channel/search/utility controls.
  - user/profile controls anchored in the lower-left account area.
  - channel/category visuals tuned to Discord-like hierarchy.
- [x] VERIFY: click-through and keyboard checks for moved controls (settings, members, pins, quick switch) on desktop and narrow layouts.

- [x] Refresh message and composer presentation to be Discord-familiar:
  - cleaner message row spacing and hover treatment.
  - avatar/name/timestamp hierarchy improvements.
  - compact yet familiar composer action layout.
- [x] VERIFY: message list/component tests still pass for actions, hover affordances, and send behavior.

- [x] Add user profile controls for local account customization:
  - avatar upload/change/remove.
  - display name and About Me settings in user settings modal.
  - persist profile preferences and keep Matrix mode compatible.
- [x] VERIFY: profile settings persistence test coverage and visible avatar update in chat/member/user panels.

### Phase 7 Verification Log (2026-02-11)

- Refined Discord-familiar shell structure and controls:
  - moved account controls into channel panel footer account strip.
  - streamlined top room header to channel/search/utility actions.
  - updated channel hierarchy visuals to match familiar Discord mental model.
- Added profile UX controls in user settings:
  - avatar upload/change/remove.
  - display name and About Me editing with limits.
  - persisted profile preferences into local settings store.
- Updated avatar rendering across main surfaces:
  - message list, member list, server settings members list, channel account strip.
- Added/updated tests:
  - `src/store/__tests__/appStore.phase7.test.ts`
  - `src/components/__tests__/user-settings-modal.phase5.test.tsx`
  - `src/components/__tests__/phase1-clickthrough.test.tsx`
- Verification commands run:
  - `npm run test` -> 50 passing tests (19/19 files).
  - `npm run test:coverage` -> passing thresholds with updated Phase 7 tests.
  - `npm run build` -> successful TypeScript + production build.
  - `npm run test:e2e` -> 2 passing tests (2/2 specs).

### Phase 7 Follow-up Polish (2026-02-11)

- [x] Cleaned message composer visual hierarchy:
  - compact single-line first impression with autosizing text area.
  - reduced control noise and stronger Discord-familiar action placement.
- [x] Relocated Voice/Video controls:
  - removed in-flow call strip beneath composer.
  - moved call controls into right-side utility stack.
- [x] Replaced emoji/character shell icons with icon-library components:
  - adopted `lucide-react` for server/channel/header/composer/thread/pins/call controls.
  - normalized icon button hitboxes and disabled/hover states.
- [x] Fixed server-settings click flow in `All Rooms`:
  - resolve to a concrete server when available.
  - disable server-settings trigger when no configurable server exists (prevents dead-click notifications).
- [x] VERIFY: run unit, build, and e2e checks after follow-up polish.
  - `npm run test` -> 50 passing tests (19/19 files).
  - `npm run build` -> successful TypeScript + production build.
  - `npm run test:e2e` -> 2 passing tests (2/2 specs).

## Implementation Notes (Matrix compatibility constraints)

- [ ] Categories and ordering must remain Matrix-compatible; avoid proprietary-only structures where Matrix state events already solve the problem.
- [ ] Permissions must map to Matrix power levels and room state auth rules instead of client-only role flags.
- [ ] Message deletion must use redaction events and update timeline rendering for redacted messages.
- [ ] Pagination must use Matrix timeline APIs; avoid loading complete room history upfront.
- [ ] VERIFY: interoperability test against at least two homeservers and one second client session.

## Done Criteria For This Overhaul

- [ ] No visible dead controls in primary UI.
- [ ] Message send behavior matches expected Discord-like defaults.
- [ ] Scroll + pagination are reliable in large rooms.
- [ ] Members panel toggling dynamically reallocates layout width.
- [ ] Categories + permissions are first-class and admin-editable.
- [ ] Admin/moderation actions are role-gated and functional.
- [ ] Hover/focus action model is clean, accessible, and touch-safe.
- [ ] Cross-platform desktop quality bar met (macOS/Windows/Linux via Tauri).
