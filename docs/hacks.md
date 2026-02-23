# Fray Hacks & Direct Upstream Modifications

This file documents every direct modification Fray makes to upstream Element Web files, along with the rationale. Each entry corresponds to a file in `fray/touchpoints.allowlist`.

For conflict resolution strategies during upstream sync, see `fray/UPDATING.md`.

---

## Webpack publicPath

**File:** `webpack.config.ts`
**Change:** Set `output.publicPath` to `"/app/"`.
**Why:** Fray is deployed under a subdirectory (`fray.chat/app/`) behind Caddy. Webpack's default `"auto"` publicPath resolves assets relative to the HTML file, which breaks when the app is served from a non-root path. Hardcoding `/app/` ensures all chunk URLs resolve correctly.

## Theme asset regex fix

**File:** `src/vector/index.html`
**Change:** Updated the `<script>` block that injects the theme `<link>` tag. The original regex assumed assets lived at the root; the replacement accounts for publicPath by stripping a leading `/` and using a relative URL.
**Why:** Without this fix, dark theme CSS fails to load when the app is served from `/app/` because the browser requests `/css/...` instead of `/app/css/...`.

## Tooltip dark theme overrides

**Files:**
- `res/themes/dark/css/_dark.pcss` — Removed Compound tooltip CSS variable declarations that forced white backgrounds in dark mode.
- `res/themes/dark/css/dark.pcss` — Added `@import url("_fray-overrides.pcss");` to load Fray-specific fixes after all upstream styles.
- `res/themes/dark/css/_fray-overrides.pcss` — New file (Fray-only, not in upstream). Resets `--cpd-color-bg-info-subtle` and `--cpd-color-text-info-primary` so tooltips render with dark backgrounds and light text.
- `res/themes/dark-custom/css/dark-custom.pcss` — Added the same `_fray-overrides.pcss` import for the "high contrast" dark theme variant.
**Why:** Element's Compound design system ships tooltip variables that produce white-on-white tooltips in dark mode. Rather than patching Compound upstream, we override the two specific variables after the rest of the theme loads.

## Conduit admin setup

**Context:** Not a code change — operational setup on the Conduit homeserver.
**What:** Registered `@nytemode:fray.chat` as the server admin via Conduit's admin API. This enables room management, federation controls, and user administration for the Fray instance.
