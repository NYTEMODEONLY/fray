# Issue 1 Plan: Eliminate `createLegacyAppState.ts`

Date: 2026-02-14  
Target Branch: `codex/refactor-minimal-client-foundation`

## Objective

Remove monolithic orchestration from `src/internal/store/createLegacyAppState.ts` by moving state/actions into true slice-native modules while preserving current `useAppStore` behavior.

## Constraints

- Keep `useAppStore` API stable for existing callers.
- Preserve default minimal behavior (flags OFF).
- Keep advanced/admin behavior gated.
- Maintain test, build, and e2e stability throughout.

## Current Responsibility Map

`createLegacyAppState.ts` currently owns:
- state defaults + mock bootstrap
- session auth lifecycle + Matrix bootstrap
- room/space/category orchestration + layout persistence
- message send/timeline/reaction/pin/redaction/pagination
- UI toggles + notifications
- settings persistence + profile sync
- calls lifecycle
- admin settings/permission/audit persistence

## Target Architecture

- `src/store/types.ts`
  - AppState contract + shared store types.
- `src/store/slices/sessionSlice.ts`
  - session/auth/bootstrap/logout + identity hydration.
- `src/store/slices/roomsSlice.ts`
  - spaces/rooms/layout/category CRUD + selection + history pagination.
- `src/store/slices/messagesSlice.ts`
  - timeline actions (send/reply/react/pin/redact/copy link/incoming).
- `src/store/slices/uiSlice.ts`
  - panel/search/notifications/online toggles.
- `src/store/slices/settingsSlice.ts`
  - preferences/profile/onboarding.
- `src/store/slices/callsSlice.ts`
  - call state and gated call actions.
- `src/store/slices/adminSlice.ts`
  - admin settings, overrides, audit actions (admin-flag path).

Shared helper modules are allowed only for pure utilities (normalization, mapping, parsing), not cross-domain orchestration.

## Execution Phases

### Phase A: Types and Shared Utilities

1. Move `AppState` and related types into `src/store/types.ts`.
2. Extract pure helpers by domain:
   - preferences/profile helpers
   - layout/category helpers
   - moderation/audit helpers
   - timeline merge helpers
3. Keep behavior parity by direct code transfer (no semantic changes).

Verification:
- `npm run test`
- `npm run build`

### Phase B: Slice-Local State Ownership

1. Replace pick-based slices with real slice creators that define initial state and actions directly.
2. Ensure each slice references only its domain helpers and explicit cross-slice calls via `get()`.
3. Remove any legacy passthrough glue usage.

Verification:
- `npm run test`
- targeted store tests:
  - `src/store/__tests__/appStore.phase2.test.ts`
  - `src/store/__tests__/appStore.phase9_4.test.ts`
  - `src/store/__tests__/appStore.calls-gating.test.ts`

### Phase C: Remove Legacy Orchestration File

1. Delete `src/internal/store/createLegacyAppState.ts`, or reduce to thin composition-only glue (<200 LOC, no business logic).
2. Update `src/store/index.ts` to compose slice creators directly.
3. Ensure imports/types point to new store type source.

Verification:
- `npm run test`
- `npm run build`
- `npm run test:e2e`

### Phase D: Regression and Flag Matrix Validation

1. Validate manual smoke matrix:
   - flag OFF: login/logout/session restore, room switch, send/reply/react/pin, DM/unread/notifications.
   - flag ON admin: open/save settings without runtime errors.
2. Re-run quality gates:
   - `npm run test`
   - `npm run build`
   - `npm run bundle:check`
   - `npm run test:e2e`

## Acceptance Mapping

- `createLegacyAppState.ts` removed or reduced to composition-only (<200 LOC).
- All operational store behavior implemented in slice-native modules.
- No regressions in core minimal flow with flags OFF.
- Full gate suite passing:
  - unit tests
  - build
  - e2e
