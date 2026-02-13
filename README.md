# Fray

**Fray** is a privacy-first, desktop-first Matrix client built to feel familiar to Discord users without cloning Discord directly.

Fray is a **Matrix client**. Your community backend is your own **Matrix homeserver**.

---

## What Fray Now Includes

- Matrix login/session persistence and offline demo mode
- Spaces/rooms listing (text, voice, video, DMs)
- Discord-familiar shell layout:
  - server rail
  - channel/category panel
  - room header + search + utility actions
  - member panel
- Message UX improvements:
  - Enter-to-send + Shift+Enter newline
  - hover action strips
  - replies, threads, reactions, pins
  - unread separators + jump-to-latest
  - upward pagination for older history
- Server/community controls:
  - server settings surface (overview, roles, members, channels, invites, moderation)
  - category/channel create + reorder
- Permission and moderation foundations:
  - Matrix power-level-aware permission service
  - redact/pin/invite/manage gating
  - moderation audit event feed
- User profile/settings UX:
  - appearance, notifications, keybinds, text/input, accessibility
  - profile customization (display name, About Me, avatar upload/remove)
- Command palette / quick switcher and keyboard shortcuts
- Native desktop updater flow (GitHub release manifest + in-app install/relaunch)
- MatrixRTC call controls (voice/video/screen share) in right utility stack
- Local UX metrics capture + report generator (telemetry-free by default)
- Tauri desktop wrapper (macOS/Windows/Linux)

---

## Tech Stack

- **UI:** React + TypeScript + Vite
- **Desktop:** Tauri (Rust)
- **Matrix:** matrix-js-sdk + MatrixRTC
- **Testing:** Vitest + Testing Library + Playwright
- **Icons:** lucide-react

---

## Quality Gates

The repository is wired for quality gates used in this overhaul:

```bash
npm run test
npm run test:coverage
npm run build
npm run test:e2e
npm run security:scan
```

Coverage thresholds are configured in `vitest.config.ts` for critical store/service logic.

---

## Getting Started

### Requirements

- Node.js 18+ (Node 20 recommended)
- Rust toolchain (for desktop builds)

### Install

```bash
npm install
```

### Run (Web)

```bash
npm run dev
```

Open `http://localhost:5173/`.

### Run (Desktop)

```bash
npm run tauri:dev
```

### Build

```bash
npm run build
npm run tauri:build
```

### Refresh / Update Shortcut

- `Cmd + R` (macOS) or `Ctrl + R` (Windows/Linux):
  - checks for a new signed desktop release,
  - downloads and installs it when available,
  - relaunches Fray automatically.
- If no update is available, it performs a normal app refresh.

---

## Connecting to a Homeserver

On first launch:

- Homeserver URL (example: `https://matrix.yourdomain.com`)
- Username or MXID
- Password

You can also use **Offline Demo** from the auth screen for local UX validation.

---

## Hosting a Fray Community

Fray does not ship a central backend. You host a Matrix homeserver and connect Fray clients to it.

- Hosting requirements: [docs/hosting-requirements.md](docs/hosting-requirements.md)
- VPS deployment/runbook: [docs/vps-matrix-runbook.md](docs/vps-matrix-runbook.md)
- Desktop update setup: [docs/desktop-updates.md](docs/desktop-updates.md)
- Overhaul architecture notes: [docs/discord-familiar-overhaul-architecture.md](docs/discord-familiar-overhaul-architecture.md)
- Matrix/Synapse parity roadmap: [docs/matrix-synapse-parity-roadmap.md](docs/matrix-synapse-parity-roadmap.md)
- Security commit cadence: [docs/security-commit-cadence.md](docs/security-commit-cadence.md)
- Rollout gates/checklist: [docs/phase6-rollout-checklist.md](docs/phase6-rollout-checklist.md)

---

## Useful Scripts

```bash
npm run test
npm run test:watch
npm run test:coverage
npm run test:e2e
npm run test:e2e:headed
npm run security:scan
npm run security:scan:staged
npm run metrics:report
npm run dev
npm run tauri:dev
```

---

## License

AGPL-3.0-or-later

---

a [nytemode](https://nytemode.com) project
