# Security Commit Cadence

Updated: 2026-02-13

Use this cadence to prevent secrets/private material from entering git history.

## Per Commit (fast)

1. Keep commits small and scoped to one concern.
2. Run staged secret scan before commit:
   - `scripts/scan-secrets.sh staged`
3. Commit only explicit paths (avoid broad adds).

## Per Push (full gate)

1. Run full-history scan:
   - `scripts/scan-secrets.sh full`
2. Run quality checks relevant to changed areas.
3. Push only after scans are clean.

## CI Enforcement

- GitHub Actions runs `gitleaks` on every pull request and push to `main`.
- Any detected leak blocks merge until remediated.

## If a Secret Is Ever Committed

1. Revoke/rotate the exposed credential immediately.
2. Remove from current files.
3. Rewrite git history to purge the secret.
4. Force-push cleaned history and notify collaborators to re-sync.
