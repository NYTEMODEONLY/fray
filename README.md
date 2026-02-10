# Fray

**Fray** is a privacy‑first, desktop‑first Matrix client built to feel familiar to Discord users while removing ads, paywalls, and cosmetic status systems. It is open‑source (AGPL‑3.0‑or‑later) and targets a clean, minimal, and egalitarian communication experience.

Fray is a **client**. To run a community like a game server, you host a **Matrix homeserver** and point Fray at it.

---

## Project Goals

- **No monetization clutter**: no ads, no Nitro‑style cosmetics, no boosts.
- **Privacy‑first**: Matrix federation + E2EE for private rooms, pseudonymous accounts.
- **Discord‑like familiarity**: servers/spaces, channels, member list, voice/video.
- **Newcomer friendly**: simple onboarding, reduced UI noise, smart unread feed.

---

## Current Status

This repo contains the MVP client with:

- Matrix login + session persistence
- Spaces/rooms listing (text, voice, video, DMs)
- Room timeline (messages, replies, threads)
- Reactions, pins, search
- Attachments (image/file upload)
- Notifications (desktop + in‑app)
- MatrixRTC group calls (voice/video/screen share)
- Tauri desktop wrapper (macOS/Windows/Linux)

---

## Tech Stack

- **UI:** React + TypeScript + Vite
- **Desktop:** Tauri (Rust)
- **Matrix:** matrix‑js‑sdk + MatrixRTC

---

## Getting Started (Client)

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

### Build (Desktop Installer)

```bash
npm run tauri:build
```

Output bundles:
`src-tauri/target/release/bundle`

---

## Connecting to a Server

Fray connects to any Matrix homeserver. On first launch, you’ll see a login screen:

- **Homeserver URL**: `https://matrix.yourdomain.com` (or `http://localhost:8008` for local)
- **Username or MXID**
- **Password**

Registration uses Matrix “dummy auth” and may be disabled on some servers.

---

## Hosting a Fray Community (Matrix Server)

To host your own Fray “server” like a game server:

- You run a Matrix homeserver
- You give your community the homeserver URL
- They connect in Fray

See:
`/Users/lobo/Desktop/Progress/Built in 2025/fray/docs/hosting-requirements.md`

---

## MatrixRTC (Voice / Video)

Voice and video are powered by MatrixRTC group calls:

- Users **join** a voice/video channel, then click **Join** in the call dock
- Calls are **off by default** (no auto‑join)
- Screen share requires user permission

For reliable voice/video across NAT, configure a TURN server on your homeserver.

---

## Project Structure

```
fray/
  src/                 # React UI
  src-tauri/           # Tauri desktop wrapper
  docs/                # Hosting + deployment docs
```

---

## Roadmap (High Level)

- Matrix UIAA registration flow
- Spaces hierarchy + onboarding improvements
- Better media handling + optimized timeline
- CI builds for macOS / Windows / Linux
- Mobile + web distribution (post‑MVP)

---

## Contributing

- Create a branch from `main` (or the active development branch)
- Keep changes small and reviewable
- Use clear commit messages

---

## License

AGPL‑3.0‑or‑later

---

## Credits

Fray is built on the Matrix ecosystem and the matrix‑js‑sdk.

---
