# Fray Matrix VPS Runbook (Docker)

This runbook documents the deployment pattern used for Fray Matrix testing on a VPS using Docker Compose.

## Scope

- Single VPS
- Dockerized services
- Synapse + PostgreSQL + Nginx
- Private sandbox mode (registration disabled)
- HTTP test mode (TLS deferred intentionally)

## Service Layout

- `postgres`: Matrix database (persistent volume)
- `synapse`: Matrix homeserver (persistent `/data`)
- `nginx`: reverse proxy on ports `80/443`

Recommended filesystem layout:

```text
/opt/fray-matrix/
  docker-compose.yml
  .env
  postgres-data/
  synapse/
  nginx/conf.d/
  certbot/conf/
  certbot/www/
  bin/fray-matrix-diagnose.sh
```

## Required Synapse Settings

- `database` uses `psycopg2` with PostgreSQL service hostname
- `enable_registration: false` for private sandbox mode
- `registration_shared_secret` configured for controlled user creation
- `x_forwarded: true` behind Nginx
- `public_baseurl` matches current test mode (`http://...` while TLS is deferred)

## PostgreSQL Requirement (Critical)

Synapse requires safe collation settings for PostgreSQL. Initialize Postgres with:

```text
--encoding=UTF-8 --lc-collate=C --lc-ctype=C
```

If this is wrong, Synapse fails startup with collation errors.

## User Management (Private Mode)

Create users with Synapse admin registration tool:

```bash
docker exec fray-synapse register_new_matrix_user \
  -u <username> -p '<password>' -a \
  -c /data/homeserver.yaml http://localhost:8008
```

## Robust Logging Standard

Apply Docker log rotation for each service:

```yaml
logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "5"
```

Keep a diagnostics helper script on the server (example path used during deployment):

```bash
/opt/fray-matrix/bin/fray-matrix-diagnose.sh
```

The script should output:

- `docker compose ps`
- Synapse health endpoint check
- public Matrix versions endpoint check
- recent logs for Synapse/Postgres/Nginx

## Smoke Tests

Check Matrix versions:

```bash
curl -s --compressed http://YOUR_HOST/_matrix/client/versions
```

Check password login:

```bash
curl -s -X POST http://YOUR_HOST/_matrix/client/v3/login \
  -H 'Content-Type: application/json' \
  --data '{"type":"m.login.password","identifier":{"type":"m.id.user","user":"YOUR_USER"},"password":"YOUR_PASSWORD"}'
```

## Client-Side Recovery Note (Fray)

If Fray shows IndexedDB startup errors after logout/login loops, verify client build includes the store bootstrap fix:

- `IndexedDBStore.startup()` is called after attaching the store to the Matrix client.
- Fray falls back to non-persistent store mode if IndexedDB startup fails.

## Next Phase (When Moving to Production)

1. Add domain and TLS (Let’s Encrypt).
2. Enable renewal automation and monitoring alerts.
3. Restrict SSH access (keys-only, disable root password login).
4. Add TURN for reliable MatrixRTC across NAT.
