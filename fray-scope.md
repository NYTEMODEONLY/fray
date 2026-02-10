# Fray - Project Scope Document

**Working Name:** Fray  
**Project Type:** Open-source communications client (desktop-first) to rival Discord  
**License:** AGPL-3.0-or-later  
**Foundation:** Matrix protocol – an open network for secure, decentralised communication (official site: https://matrix.org/)  
**Primary Goal:** Provide a clean, minimal, intuitive, privacy-first alternative to Discord amid growing user frustration with ads, paywalls, Nitro cosmetics, and the upcoming March 2026 global "teen-by-default" age verification rollout (facial age estimation via video selfie or government ID upload required for full access; phased starting early March 2026, restricting unverified users to limited teen-appropriate features like censored content, rerouted DMs, no stage speaking).  
**Target Release Timing:** Aggressive MVP push before early March 2026 to capitalize on backlash and migration momentum. No hard deadline, but aim for functional desktop alpha/preview in 3–4 weeks from February 2026 start.  
**Developer:** Solo (NYTEMODE / @nytemodeonly) + AI coding assistants (Claude, Cursor, Copilot-style tools) for rapid development, testing, and iteration.  
**Repo Location:** GitHub https://github.com/NYTEMODEONLY/fray

## 1. Project Vision & Differentiation

Fray is an open-source, federated communications client built on the Matrix protocol[](https://matrix.org/) to serve as a true Discord alternative. It prioritizes:

- **No monetization clutter** — Zero ads, no Nitro-style subscriptions, no purchasable cosmetics/flair (avatars, profiles, decorations), no server boosting economy, no in-app shop or orbs currency system.
- **Egalitarian experience** — All users equal; no "haves vs. have-nots" from paid visual status indicators. Focus stays on communication, not shopping or social pressure.
- **Privacy-first by design** — Leverage Matrix's native E2EE in private rooms, pseudonymous accounts, no forced personal data collection, resistance to invasive practices like Discord's AI scanning or ID mandates.
- **Discord familiarity with improvements** — Retain the intuitive server/channel/role/voice structure users know, but make it cleaner, more minimal, and newbie-friendly (reduce overwhelm in dense servers).

**Top Pain Points Addressed from Discord (Beyond Privacy/ID Changes):**
1. Heavy commercialization (upsells, banners, paywalled flair/cosmetics creating inferiority feelings).
2. UI clutter from ads, sponsored content, quests, and monetized elements.
3. Overwhelming onboarding for new users in large/dense servers (too many channels, no clear "start here").

**Differentiation "Wow" Factors:**
- Seamless migration path via self-hosting freedom and potential bridges.
- Clean, distraction-free UI with smart newcomer aids.
- True openness: full federation + easy private lockdown.

## 2. Target Audience

**Universal** — Appeal to any group frustrated with Discord:
- Gamers (voice/screen share focus).
- General communities, artists, roleplayers, tech/open-source groups.
- Privacy advocates concerned about data collection, biometrics, AI profiling.
- Users tired of paywalls, ads, and status-based cosmetics.

No niche lock-in; aim for broad adoption during the March 2026 backlash wave.

## 3. Core Features & Parity Goals

**MVP 1.0 Focus (Desktop Cross-Platform):**
Achieve near-feature-parity so switching feels native—no major "missing X" complaints. Prioritize top 3: text chat, voice, video.

**Must-Have for 1.0:**
- **Text Chat** — Unlimited history, rich markdown/embeds, reactions, threads/replies, mentions (@autocomplete on display name/MXID), file/image/GIF sharing, search, unread badges, pinned messages, spoilers, code blocks.
- **Voice Channels** — Persistent/always-on rooms, join/leave seamless, voice activity + PTT, low-latency (via MatrixRTC), noise suppression/echo cancel, speaking indicators.
- **Video & Screen Share** — Group video in channels/DMs, screen/game/window share, basic quality controls (zoom/pan if possible).
- **Servers/Communities (Matrix Spaces)** — Create/join Spaces, add Rooms/channels/categories, basic roles/permissions via power levels.
- **Member List & Presence** — Online/offline status, member sidebar.
- **DMs/Group DMs** — Direct messaging support.
- **Onboarding/Usability** — Pseudonymous registration (username/password only), guided first-join (highlight welcome channel, auto-collapse dense channels), smart unread feed, collapsible categories.
- **Cross-Platform Desktop** — Windows/macOS/Linux via Tauri (https://tauri.app/ and https://github.com/tauri-apps/tauri); system tray, notifications, offline queuing.
- **Notifications** — Reliable mentions/unreads (system + in-app).

**Non-Negotiables for Familiarity:**
- Sidebar layout: left server list, middle channels/messages, right members/info (collapsible).
- Dark/light themes (Discord-inspired crisp look, minimal by default).
- No paywalls/cosmetics/ads.

**Stretch (Post-1.0):**
- Mobile/web support.
- Advanced threading prominence.
- Guest/anonymous joins.
- Bridges (e.g., Discord import).

## 4. Technical Architecture

**Client-Side:**
- **Stack:** Tauri (https://tauri.app/ and https://github.com/tauri-apps/tauri) + React/TypeScript + matrix-js-sdk[](https://github.com/matrix-org/matrix-js-sdk).
- **Base:** Fork Element Web[](https://github.com/element-hq/element-web) → migrate to Tauri wrapper → heavy customization/stripping.
- **Why Fork Element Web:** Most feature-complete Matrix client (chat, MatrixRTC voice/video/screen share, Spaces, E2EE). Proven, active (latest commits February 2026), multi-licensed (AGPL-3.0 / GPL-3.0 / commercial).
- **Customizations:** Remove telemetry/promos, simplify UI, Discord-like theming/layout, add newcomer flows (collapsing, guided panes), enforce minimalism.
- **License Handling:** Preserve Element copyrights/NOTICE; add AGPL-3.0 for our changes.

**Matrix Integration:**
- Full federation support (join any homeserver's rooms by default).
- Self-hosted/private mode encouraged (disable federation, invite-only).
- E2EE defaults in private rooms.
- Homeserver: Synapse (recommended; https://github.com/element-hq/synapse) – Matrix homeserver written in Python/Twisted + Rust; Docker Compose guides; alternatives (Dendrite/Conduit) documented.

**Self-Hosting Story:**
- Comprehensive guides in repo (/docs/self-hosting).
- Docker Compose templates (public/federated vs. private/locked).
- One-click-ish setup scripts (env config, domain, HTTPS via Nginx/certbot).
- Client branding integration (config.json for name, logos, default homeserver).
- Privacy defaults: no telemetry, optional email skip, invite-only options.

## 5. Privacy & Security

**Beyond Matrix E2EE:**
- No telemetry by default (strip from fork).
- Pseudonymous accounts: username/password only; no forced email/phone.
- Registration: Optional email (skip for privacy); no phone/MSISDN.
- Optional email binding: Only opt-in for newsletters/announcements (clear consent).
- Metadata resistance via private rooms/self-hosted closed federation.
- Verifiable builds encouraged in future.
- Guest mode support for low-friction public room browsing.

**Inspiration from Alternatives (e.g., Stoat/Revolt):**
- Borrow UI polish/responsiveness for Discord parity.
- Aim for similar self-host ease (reference: https://github.com/stoatchat/stoatchat for backend; https://github.com/stoatchat/self-hosted for deployment; https://stoat.chat/ for project site).
- Stick with Matrix for federation + mature E2EE (Stoat lacks both).

## 6. Development & Community Process

**Current Team:** nytemode
**License:** AGPL-3.0-or-later (prevents proprietary forks, ensures changes stay open).
**Repo Setup:**
- GitHub central (code, issues, PRs, releases, Discussions/Projects board).
- Structure: src/, public/, docs/, CONTRIBUTING.md, LICENSE, NOTICE, CREDITS.md, README.md.
- README: Mission, status, build instructions, contribution guide, screenshots.
- Community: Matrix space (#fray:matrix.org or similar) for dev/feedback; Reddit (r/selfhosted, r/privacy, etc.); X (@nytemodeonly).

**Contribution Flow:**
- Discuss in Matrix → fork → branch → PR.
- Simple process; scale later.

**Timeline & Milestones (Aggressive Pre-March 2026):**
- Week 1: Fork Element Web[](https://github.com/element-hq/element-web), Tauri setup[](https://github.com/tauri-apps/tauri), basic branding/stripping.
- Week 2: Core chat + voice reliability, onboarding tweaks.
- Week 3: Video/share polish, notifications, cross-platform builds.
- Week 4: Dogfood, alpha release on GitHub, announce on X/Reddit/Matrix.
- Post-MVP: Mobile, full migration tools, community growth.

**Risks & Mitigations:**
- Time crunch: Prioritize desktop + core comms; use AI heavily.
- Federation hiccups: Recommend reliable homeservers; client fallbacks.
- UI polish: Reference Stoat patterns + heavy theming.

This document serves as the master scope reference for AI-assisted development. Update as features evolve.

**Last Updated:** February 2026 (based on scoping conversations).  
**Owner:** NYTEMODE (@nytemodeonly)
**Website:** nytemode.com
