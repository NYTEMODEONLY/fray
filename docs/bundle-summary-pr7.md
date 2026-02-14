# Bundle Summary (PR-7)

Date: 2026-02-14

## Method

- Baseline: `npm run build` before PR-7 chunking/lazy-loading changes.
- After: `npm run build` after PR-7 changes (`feature-calls` lazy import + Rollup `manualChunks`).

## Before vs After

| Metric | Before | After |
| --- | ---: | ---: |
| Core app chunk(s) | `index` 206.19 kB + `index` 1,211.40 kB | `index` 334.86 kB + `vendor-matrix` 1,055.12 kB |
| Admin chunk | `ServerSettingsModal` 31.08 kB | `feature-admin` 40.66 kB |
| Calls chunk | inlined in main path | `feature-calls` 18.46 kB |
| Core app+matrix total | 1,417.59 kB | 1,389.98 kB |

## Notes

- Advanced admin UI remains lazy and feature-flagged.
- Call dock is now lazy-loaded and separated into `feature-calls`.
- Matrix SDK is now an explicit vendor chunk (`vendor-matrix`) for clearer caching/chunk boundaries.
- Core app+matrix payload reduced by ~27.61 kB (~1.95%) versus baseline.
