# Fray

**Chat that respects you.**

Fray is an opinionated fork of [Element Web](https://element.io) — the most mature client for the [Matrix](https://matrix.org) protocol. Dark-only, privacy-first, stripped of bloat. End-to-end encrypted messaging with nothing in the way.

[Open Web Client](https://fray.chat/app) &nbsp;|&nbsp; [Landing Page](https://fray.chat)

---

## What stays

- Full Matrix protocol support — federation, rooms, spaces, threads
- End-to-end encryption via Olm/Megolm
- Voice and video calls with WebRTC
- Cross-signing, key backup, device verification

## What changes

- **Dark-only** — no light mode, no theme switching, no compromises
- **Stripped down** — no widgets, no integrations panel, no feature bloat
- **Zero tracking** — no analytics, no telemetry, ever
- **Fray branding** — custom typography, interaction design, and visual language

## Run your own homeserver

Fray connects to any Matrix homeserver. We encourage you to run your own — it takes about 10 minutes with Docker.

**1. Set up [Synapse](https://element-hq.github.io/synapse/latest/setup/installation.html)** (the reference Matrix homeserver):

```bash
# Generate config
docker run --rm -v /opt/synapse/data:/data \
  -e SYNAPSE_SERVER_NAME=your.domain \
  -e SYNAPSE_REPORT_STATS=no \
  matrixdotorg/synapse:latest generate

# Run it
docker compose up -d
```

**2. Point Fray at your server.** When logging in, click "Edit" next to the homeserver URL and enter your domain.

**3. That's it.** You own your data, your conversations, and your infrastructure. No single point of failure, no vendor lock-in, no central authority.

For a full guide including PostgreSQL, nginx reverse proxy, and TLS setup, see the [Synapse documentation](https://element-hq.github.io/synapse/latest/setup/installation.html).

## Development

### Prerequisites

- [Node.js 24](https://nodejs.org/) (via [Volta](https://volta.sh/))
- [pnpm](https://pnpm.io/)

### Build and run

```bash
volta run --node 24 pnpm install         # install dependencies
volta run --node 24 pnpm start           # dev server on :8080
volta run --node 24 pnpm build           # production build → webapp/
```

### Verify customization boundaries

Before and after syncing with upstream Element Web:

```bash
pnpm fray:verify-touchpoints
```

## Fray customization layer

All Fray-specific code lives under `apps/web/src/vector/fray/` to minimize upstream merge conflicts:

```
apps/web/src/vector/fray/
  index.ts              Entry point (imports theme lock + styles)
  theme-lock.ts         Forces dark mode at runtime
  styles/
    tokens.css          CSS custom properties (accent, backgrounds, text, borders)
    shell.css           App shell and base surfaces
    room-list.css       Room list and selection states
    room-header.css     Room header styling
    auth.css            Login and registration pages
    timeline.css        Message bubbles and reply chains
    composer.css        Message input and send button
    content.css         Inline content, pills, mentions
    panels.css          Side panels (member list, settings, etc.)
    fray-overrides.css  Deploy-time CSS overlay
```

Upstream files that Fray touches directly are tracked in `fray/touchpoints.allowlist`.

## License

Fray is open source. The upstream Element Web code is licensed under [AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.html). Fray-specific additions are under the same license unless noted otherwise.

---

Built by [NYTEMODE](https://nytemode.com) &nbsp;|&nbsp; Powered by [Matrix](https://matrix.org) &nbsp;|&nbsp; Fork of [Element Web](https://element.io)
