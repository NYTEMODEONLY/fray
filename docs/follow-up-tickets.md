# Follow-Up Tickets

## FRAY-201: Split `createLegacyAppState.ts` into real store slices

- Status: Open
- Priority: High
- Scope:
  - Remove the legacy compatibility blob at `/Users/lobo/Desktop/Progress/Built in 2025/fray/src/internal/store/createLegacyAppState.ts`.
  - Move actions/state ownership into true slice-local modules under `/Users/lobo/Desktop/Progress/Built in 2025/fray/src/store/slices/`.
  - Keep `useAppStore` consumer API stable.
- Acceptance:
  - no single store implementation file above 1500 lines,
  - no `createLegacyAppState` compatibility layer remaining,
  - `npm run test`, `npm run build`, `npm run test:e2e` all pass.

## FRAY-202: Complete end-to-end calls feature gating

- Status: Open
- Priority: High
- Scope:
  - Extend `VITE_ENABLE_ADVANCED_CALLS` gating beyond current UI/store guards.
  - Ensure calls-related room creation, command paths, and non-essential RTC setup are consistently gated.
  - Add explicit tests for flag OFF and flag ON behavior.
- Acceptance:
  - with flag OFF: no call controls/actions are reachable and no call init path runs,
  - with flag ON: calls flow remains functional,
  - test coverage includes both states and remains stable across repeated runs.
