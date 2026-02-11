# Fray Hosting & Deployment Requirements

Fray is a **Matrix client**. To run your own Fray community, you host a **Matrix homeserver**. There is no special “Fray server” binary required. If you can run a Matrix homeserver, Fray can connect to it.

This guide is intentionally short and practical, like standing up a game server.

---

## Quick Summary

- **Best default:** Synapse (most common, reference homeserver)
- **Fastest path:** One VPS + a Matrix homeserver
- **Voice/Video:** Works best with a TURN server
- **Federation:** Optional (public or private)

---

## Choose a Homeserver

### Recommended (default)
- **Synapse**: reference implementation, widest compatibility.

### Lightweight options
- **Conduit / continuwuity / Tuwunel**: lighter footprint, good for small/medium servers.

### Performance‑focused (advanced)
- **Dendrite**: efficient and scalable, but historically more “beta” feel.

If you want the **safest path for compatibility**, pick **Synapse**.

---

## Hosting Options

### Option A: VPS (Most common)
- Run on a cloud VM (DigitalOcean, Hetzner, Linode, Vultr, AWS, etc.)
- Public IP + domain name
- Easiest to keep online 24/7

### Option B: Home Server
- Works for small groups
- Requires port forwarding and a stable connection
- More maintenance and reliability risks

### Option C: Managed Matrix Hosting
- Zero‑ops setup (pay a provider to host Matrix)
- Best if you don’t want to manage infrastructure

---

## Minimum Requirements (Starting Point)

These are **starter** specs for small communities. Scale up as users grow.

### Small (10–50 users)
- 1–2 vCPU
- 2–4 GB RAM
- 20–40 GB SSD

### Medium (50–200 users)
- 2–4 vCPU
- 4–8 GB RAM
- 60–120 GB SSD

### Large (200+ users)
- 4–8+ vCPU
- 8–16+ GB RAM
- 200+ GB SSD

**Storage grows with chat history + media.** Plan accordingly.

---

## Network Requirements

You need a public domain and HTTPS.

Minimum open ports:
- `443` (HTTPS)
- `8448` (Matrix federation, if public)

Optional:
- `3478/5349` (TURN server for voice/video)
- `49152–65535` (TURN relay range)

If your server is **private only**, you can disable federation and only expose what you need.

---

## Core Setup Checklist

1. Pick a homeserver (Synapse recommended)
2. Choose hosting (VPS is easiest)
3. Point a domain to the server IP
4. Enable TLS (Let’s Encrypt is fine)
5. Create your admin user
6. Set registration policy (open, invite‑only, or token‑based)
7. Test Fray login and room creation
8. Add TURN if you want reliable voice/video

---

## Docker Deployment Pattern (Recommended)

For compartmentalized hosting, run Matrix in Docker with separate services:

- `postgres` (database)
- `synapse` (homeserver)
- `nginx` (reverse proxy / ingress)

Persist these paths as volumes:

- PostgreSQL data directory
- Synapse `/data` (keys, config, media)
- TLS/certbot data (if HTTPS enabled)

Reference deployment runbook:
- [docs/vps-matrix-runbook.md](vps-matrix-runbook.md)

---

## Backend & Storage Model (What You Host)

Fray is only the client UI. Your Matrix homeserver is the backend and system of record.

In practice, self-hosting means you own three persistent data layers:

1. **Database (required)**  
   Stores users, room state, timeline metadata, memberships, auth/session records, and server config state.
2. **Media storage (required)**  
   Stores uploaded files/images and cached remote media.
3. **Server keys/secrets (required)**  
   Stores signing keys and sensitive config needed to preserve server identity and trust.

If you are using containers, mount persistent volumes for all three.  
If any one of these is lost, you will have partial or full data/identity loss.

### Operational Recommendation

- **Small testing setup**: single host with persistent disk is fine.
- **Production setup**: PostgreSQL database, persistent media volume/object storage strategy, and encrypted key backups.

### Database Recommendation (Matrix + Fray)

If you are running Synapse, the practical recommendation is:

1. **Use PostgreSQL for production** (recommended default for real communities).
2. **Use SQLite only for local testing or tiny short-lived setups**.

Why:

- Synapse uses SQLite as the default if no database is configured.
- Synapse worker mode requires PostgreSQL (SQLite is a single-process option).
- Advanced options such as database sharding are PostgreSQL-only.

Fray itself is database-agnostic here. It talks Matrix to your homeserver, so the DB decision is entirely a server-operator choice.

Reference (Synapse docs):
- Database configuration defaults (SQLite if unspecified): https://element-hq.github.io/synapse/develop/usage/configuration/config_documentation.html#database
- Worker mode and scaling requirements (PostgreSQL required for workers): https://element-hq.github.io/synapse/develop/workers.html

### Backup Minimum

At minimum, back up:

- database dumps/snapshots
- media directory or object bucket
- homeserver keys and secret config

Run backups on a schedule and test restore at least once before inviting a large community.

---

## Observability & Error Logging (Docker)

You should have two layers of logging:

1. **Container runtime logs** (stdout/stderr from `synapse`, `postgres`, `nginx`).
2. **Application health checks** (Matrix API + service readiness).

Recommended compose logging policy (prevents unbounded log growth):

```yaml
logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "5"
```

Fast triage commands:

```bash
docker compose ps
docker compose logs --tail=200 synapse
docker compose logs --tail=120 postgres
docker compose logs --tail=120 nginx
curl -s --compressed http://YOUR_HOST/_matrix/client/versions
```

Optional but strongly recommended:

- Keep a one-command diagnostics script on-host (for example `fray-matrix-diagnose.sh`) that runs service status, health checks, and recent logs together.

---

## Fray Client Configuration

When Fray asks for a homeserver, use your base URL:

- Example: `https://matrix.yourdomain.com`

You can share this with your community as the “server address.”

If you are in temporary HTTP test mode, use `http://...` explicitly.

---

## Federation vs Private Servers

- **Federated (public):** Your server can communicate with other Matrix servers.
- **Private (closed):** Only your users can join. Best for game‑like communities.

Fray supports both. Choose based on your privacy and growth goals.

---

## Voice / Video (MatrixRTC)

MatrixRTC works best with a TURN server, especially across NAT or mobile networks.
If you want “Discord‑like” reliability, **TURN is strongly recommended**.

---

## “Game Server” Mental Model

Think of the Matrix homeserver as your dedicated game server:
- You own the server and data
- You control access
- Your community connects to *your* server with Fray

---

## What’s Next

If you want, we can add a second doc with:
- One‑page Synapse install
- TURN server setup
- Fray branding + default homeserver config
