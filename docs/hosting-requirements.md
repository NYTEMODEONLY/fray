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

## Fray Client Configuration

When Fray asks for a homeserver, use your base URL:

- Example: `https://matrix.yourdomain.com`

You can share this with your community as the “server address.”

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
