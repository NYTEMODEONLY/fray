# Matrix/Synapse Parity Roadmap

Updated: 2026-02-13

This roadmap captures the integration gaps found while comparing Fray against the live Synapse deployment.

## Goal

Reach end-to-end Matrix parity for core community use cases, with predictable behavior across self-hosted Synapse environments.

## P0 - Reliability Blockers

- Align auth UX with live server login flows:
  - keep password login
  - hide/disable in-app registration when `enable_registration` is off
  - add clear server-driven auth errors in the auth screen
- Fix channel hard-delete permission model:
  - detect Synapse admin capability up front
  - gate hard-delete UI for non-admin users
  - offer safe fallback (leave/forget + state removal) when hard-delete is unavailable
- Improve MatrixRTC survivability:
  - detect missing TURN response (`/voip/turnServer` empty payload)
  - warn admins in server health panel
  - keep call UX functional with degraded-network warning state
- Deploy production network baseline:
  - working TLS on `443`
  - correct `public_baseurl` (`https://...`)
  - valid `.well-known` for client/server discovery when using a domain

## P1 - Protocol Parity

- Implement typing indicators (`sendTyping`) and room typing state rendering.
- Implement read receipts/read markers (`sendReadReceipt`/`setRoomReadMarkers`) and consume remote receipt state.
- Add presence support (publish + subscribe) and presence-aware member list status.
- Expand timeline event coverage:
  - edits (`m.replace`)
  - additional state/system events needed for moderation/context continuity
- Complete E2EE UX:
  - device verification flows
  - cross-signing and secure key backup/status handling
- Add non-password auth support:
  - SSO/token-based login where homeserver advertises those flows

## P2 - Admin/Operations Completeness

- Add device/session management UI (view sessions, sign out others).
- Expose push notification pusher configuration status in client settings.
- Add a server compatibility check page:
  - auth flows
  - media limits
  - TURN availability
  - federation/public endpoint readiness

## Verification Gates

- For each roadmap item:
  - add/update tests (unit/component/e2e as appropriate)
  - run `npm run test` and `npm run build`
  - when networking behavior changes, validate against live Synapse endpoints before marking complete
