# Repository Guidelines

## Project Structure & Module Organization
Fray is a React + TypeScript frontend with a Tauri (Rust) desktop shell.

- `src/`: main web app code
- `src/components/`, `src/store/`, `src/services/`, `src/hooks/`, `src/utils/`: feature and shared modules
- `src/**/__tests__/`: colocated unit/integration tests
- `tests/e2e/`: Playwright end-to-end specs
- `src-tauri/src/`: Rust entry points for desktop runtime
- `docs/`: architecture, hosting, rollout, and operations documentation
- `scripts/`: utility scripts (for example metrics reporting)

## Build, Test, and Development Commands
- `npm install`: install dependencies
- `npm run dev`: run Vite dev server (web)
- `npm run build`: type-check with `tsc -b` and build production web assets
- `npm run preview`: preview production web build
- `npm run test`: run Vitest test suite once
- `npm run test:coverage`: run tests with coverage report
- `npm run test:e2e`: run Playwright specs in `tests/e2e`
- `npm run tauri:dev`: run desktop app locally
- `npm run tauri:build`: build desktop binaries

## Coding Style & Naming Conventions
TypeScript runs in strict mode (`tsconfig.json`), so avoid `any` and keep types explicit at boundaries.

- Follow existing style: 2-space indentation, semicolons, double-quoted imports
- React components: `PascalCase` filenames (example: `ServerSettingsModal.tsx`)
- Hooks: `use*` camelCase (example: `useMediaPreview.ts`)
- Tests: `*.test.ts` / `*.test.tsx`; phase-tag suffixes are used when relevant (example: `phase9_5`)

## Testing Guidelines
Unit and component tests use Vitest + Testing Library in `jsdom`. E2E tests use Playwright with a local web server.

- Keep tests close to code in `__tests__` when practical
- Cover behavior, not implementation details
- Coverage thresholds currently apply to `src/store/appStore.ts` and `src/services/**/*.ts` (see `vitest.config.ts`)
- Run `npm run test`, `npm run test:coverage`, and `npm run test:e2e` before opening larger PRs

## Commit & Pull Request Guidelines
Recent history favors short imperative commit titles (`Fix`, `Ship`, `Harden`, `Clarify`) with clear intent.

- Commit message pattern: imperative verb + outcome/context
- Keep commits focused; avoid mixing frontend, backend, and docs churn unnecessarily
- PRs should include: problem summary, key changes, validation steps, and linked issue(s)
- Include screenshots or short recordings for UI/UX changes and note desktop/web impact separately
