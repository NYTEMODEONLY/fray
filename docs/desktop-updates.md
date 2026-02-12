# Fray Desktop Update Setup

Fray now uses Tauri's native updater plugin for desktop self-updates.

## User Flow

- On desktop launch, Fray performs a background update check.
- If an update is found, users are notified in-app.
- `Cmd+R` / `Ctrl+R` triggers update install:
  - check for update
  - download + install
  - relaunch app
- If no update is available, `Cmd+R` / `Ctrl+R` performs a normal refresh.

## Current Config

Updater config lives in `src-tauri/tauri.conf.json`:

- endpoint: `https://github.com/NYTEMODEONLY/fray/releases/latest/download/latest.json`
- updater artifacts enabled: `bundle.createUpdaterArtifacts = true`
- updater ACL enabled in `src-tauri/capabilities/default.json`
- desktop release workflow: `.github/workflows/release-tauri-updater.yml`

## Required Release Preconditions

To make self-update work end-to-end in production:

1. Keep the updater keypair safe:
   - private key on your machine (for Fray: `~/.tauri/fray-updater.key`)
   - public key in `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`)
2. Keep CI secrets configured:
   - `TAURI_SIGNING_PRIVATE_KEY`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
3. Publish GitHub releases (or run the manual workflow) so assets include:
   - platform bundles
   - `.sig` files
   - `latest.json`
4. Keep app `version` in `src-tauri/tauri.conf.json` aligned with release tags.

Without these items, update checks will fail safely and Fray falls back to refresh behavior.

## CI/CD Notes

Typical Tauri updater pipelines set signing secrets as environment variables in CI and run `tauri build` to produce signed updater artifacts + manifest.

Reference:
- https://v2.tauri.app/plugin/updater/
