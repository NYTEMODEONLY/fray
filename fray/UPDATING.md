# Fray Upstream Update Workflow

This project is intentionally structured so Element upstream updates stay easy to adopt.
Scope baseline for acceptance: `../fray-matrix-client-build-spec.md` (repo root).

## Rules

- Keep Fray-specific behavior in `src/vector/fray/` whenever possible.
- Keep direct upstream touchpoints minimal and explicit in `fray/touchpoints.allowlist`.
- Avoid monolithic overrides; split concerns into focused files.

## Version Tracking

The file `fray/VERSION` records the upstream commit and version Fray is currently based on. It is updated automatically by the sync script and should be committed after each sync.

## Update Steps

### Quick (automated)

```bash
bash scripts/fray/sync-upstream.sh
```

This will fetch upstream, show what changed, rebase, verify touchpoints, build, and update `fray/VERSION`. Use `--dry-run` to preview without applying.

### Manual

1. Ensure your branch is clean and fetch upstream:

   ```bash
   git fetch upstream develop
   ```

2. Rebase or merge onto the latest upstream `develop`.

3. Run touchpoint guardrails:

   ```bash
   pnpm fray:verify-touchpoints
   ```

4. Build and smoke test:

   ```bash
   volta run --node 24 pnpm build
   ```

5. Verify the resulting behavior against `fray-matrix-client-build-spec.md`.

6. If `fray:verify-touchpoints` fails:
   - Move new code into `src/vector/fray/` when feasible.
   - If direct edits are unavoidable, add a scoped entry to `fray/touchpoints.allowlist` with rationale in `docs/hacks.md`.

7. Update `fray/VERSION` with the new base ref and date.

## Conflict Resolution Strategy

When rebasing introduces conflicts, the sync script classifies each conflicting file as allowlisted (expected) or unexpected. Use the table below to resolve each one.

| File | Fray Change | Conflict Strategy | Priority |
|------|-------------|-------------------|----------|
| `src/vector/index.ts` | Imports `initFray()` at top | Keep our import line, accept upstream changes to rest of file | HIGH |
| `src/vector/index.html` | publicPath regex fix for subdirectory deployment | Re-apply regex replacement if upstream changes the template | HIGH |
| `webpack.config.ts` | `publicPath: "/app/"` for subdirectory hosting | Re-apply the single `publicPath` line after accepting upstream merge | HIGH |
| `package.json` | Fray name, version, scripts | Keep our metadata fields, accept upstream dependency updates | HIGH |
| `src/SdkConfig.ts` | Fray default config keys | Merge carefully — accept upstream structure changes, re-apply our defaults | MED |
| `src/i18n/strings/en_EN.json` | Fray branding strings | Accept upstream additions, keep our overridden keys | MED |
| `res/themes/dark/css/_dark.pcss` | Tooltip CSS variable removals | Re-check if upstream changes the tooltip variable section | MED |
| `res/themes/dark/css/dark.pcss` | Added `_fray-overrides.pcss` import | Re-add our import line at the end after merge | MED |
| `res/themes/dark-custom/css/dark-custom.pcss` | Added `_fray-overrides.pcss` import | Re-add our import line at the end after merge | MED |
| `res/manifest.json` | Fray branding and relative icon paths | Keep ours entirely — upstream branding is irrelevant | LOW |
| `config.json` | Homeserver URL, features, branding | Keep ours entirely | LOW |
| `res/welcome.html` | Fray branding | Keep ours entirely | LOW |
| `res/css/views/auth/_Welcome.pcss` | Fray auth styling | Keep ours, review if upstream restructures auth CSS | LOW |
| `src/components/structures/HomePage.tsx` | Fray home page | Keep ours, accept upstream prop/interface changes | LOW |
| `src/components/views/auth/AuthHeaderLogo.tsx` | Fray logo | Keep ours entirely | LOW |
| `src/components/views/auth/AuthPage.tsx` | Fray auth page | Keep ours, accept upstream structural changes | LOW |
| `src/components/views/auth/Welcome.tsx` | Fray welcome screen | Keep ours entirely | LOW |
| `src/async-components/structures/ErrorView.tsx` | Fray error branding | Keep ours entirely | LOW |
| `src/vector/mobile_guide/index.html` | Fray mobile branding | Keep ours entirely | LOW |
| `src/vector/mobile_guide/index.ts` | Fray mobile config | Keep ours entirely | LOW |
| `src/vector/mobile_guide/mobile-apps.ts` | Fray app store links | Keep ours entirely | LOW |

### General guidelines

- **"Keep ours entirely"** — Use `git checkout --ours <file>` during rebase conflicts.
- **"Re-apply line"** — Accept upstream (theirs), then manually re-add our specific change.
- **"Merge carefully"** — Read both sides of the conflict. Upstream may add new keys/imports we should keep alongside our additions.
- After resolving all conflicts, always run `pnpm fray:verify-touchpoints` before continuing.
