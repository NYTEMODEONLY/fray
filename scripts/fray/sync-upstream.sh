#!/usr/bin/env bash
#
# sync-upstream.sh — Interactive helper for rebasing Fray onto upstream Element Web.
# Usage:
#   bash scripts/fray/sync-upstream.sh              # full interactive sync
#   bash scripts/fray/sync-upstream.sh --dry-run    # preview upstream changes only
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VERSION_FILE="$REPO_ROOT/fray/VERSION"
UPSTREAM_REF="${FRAY_UPSTREAM_REF:-upstream/develop}"
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

cd "$REPO_ROOT"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

info()  { printf '\033[1;34m[fray]\033[0m %s\n' "$*"; }
warn()  { printf '\033[1;33m[fray]\033[0m %s\n' "$*"; }
error() { printf '\033[1;31m[fray]\033[0m %s\n' "$*"; }
ask()   { printf '\033[1;36m[fray]\033[0m %s ' "$*"; read -r REPLY; }

current_base_ref() {
  if [[ -f "$VERSION_FILE" ]]; then
    grep '^base_ref:' "$VERSION_FILE" | awk '{print $2}'
  fi
}

# ---------------------------------------------------------------------------
# Step 1: Preflight checks
# ---------------------------------------------------------------------------

if [[ -n "$(git status --porcelain)" ]]; then
  error "Working tree is dirty. Commit or stash changes before syncing."
  exit 1
fi

info "Fetching upstream ($UPSTREAM_REF)..."
git fetch upstream develop

CURRENT_BASE=$(current_base_ref)
UPSTREAM_HEAD=$(git rev-parse "$UPSTREAM_REF")
MERGE_BASE=$(git merge-base HEAD "$UPSTREAM_REF" 2>/dev/null || true)

if [[ -z "$MERGE_BASE" ]]; then
  error "Cannot find merge base with $UPSTREAM_REF. Is the remote configured?"
  exit 2
fi

# ---------------------------------------------------------------------------
# Step 2: Show what changed upstream
# ---------------------------------------------------------------------------

COMMIT_COUNT=$(git rev-list --count "$MERGE_BASE".."$UPSTREAM_REF")
info "Upstream has $COMMIT_COUNT new commit(s) since merge base ($MERGE_BASE)."

if [[ "$COMMIT_COUNT" -eq 0 ]]; then
  info "Already up to date with upstream. Nothing to do."
  exit 0
fi

echo ""
info "Upstream commits since last sync:"
git log --oneline "$MERGE_BASE".."$UPSTREAM_REF" | head -30
echo ""

info "Files changed upstream:"
git diff --stat "$MERGE_BASE".."$UPSTREAM_REF" | tail -5
echo ""

if $DRY_RUN; then
  info "Dry run complete. No changes applied."
  exit 0
fi

# ---------------------------------------------------------------------------
# Step 3: Confirm and rebase
# ---------------------------------------------------------------------------

ask "Proceed with rebase onto $UPSTREAM_REF? [y/N]"
if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
  info "Aborted."
  exit 0
fi

info "Rebasing onto $UPSTREAM_REF..."
if ! git rebase "$UPSTREAM_REF"; then
  echo ""
  warn "Rebase encountered conflicts."

  # Load allowlist for conflict classification
  ALLOWLIST_FILE="$REPO_ROOT/fray/touchpoints.allowlist"
  CONFLICT_FILES=$(git diff --name-only --diff-filter=U 2>/dev/null || true)

  if [[ -n "$CONFLICT_FILES" ]]; then
    echo ""
    info "Conflicting files:"
    while IFS= read -r f; do
      if grep -qxF "$f" "$ALLOWLIST_FILE" 2>/dev/null; then
        printf "  \033[33m%s\033[0m  (allowlisted — expected)\n" "$f"
      else
        printf "  \033[31m%s\033[0m  (NOT allowlisted — investigate)\n" "$f"
      fi
    done <<< "$CONFLICT_FILES"
  fi

  echo ""
  warn "Resolve conflicts, then run: git rebase --continue"
  warn "After resolution, re-run this script with no arguments to finish."
  exit 1
fi

info "Rebase successful."

# ---------------------------------------------------------------------------
# Step 4: Verify touchpoints
# ---------------------------------------------------------------------------

info "Running touchpoint verification..."
if ! pnpm fray:verify-touchpoints; then
  error "Touchpoint verification failed. New upstream changes may have introduced unexpected file edits."
  error "Review the files above, then either:"
  error "  - Move code into src/vector/fray/"
  error "  - Add entries to fray/touchpoints.allowlist"
  exit 1
fi

# ---------------------------------------------------------------------------
# Step 5: Build check
# ---------------------------------------------------------------------------

ask "Run build to verify? [Y/n]"
if [[ ! "$REPLY" =~ ^[Nn]$ ]]; then
  info "Building..."
  if pnpm build; then
    info "Build succeeded."
  else
    error "Build failed. Fix errors before proceeding."
    exit 1
  fi
else
  warn "Skipping build. Run 'pnpm build' manually before pushing."
fi

# ---------------------------------------------------------------------------
# Step 6: Update VERSION file
# ---------------------------------------------------------------------------

NEW_BASE=$(git rev-parse "$UPSTREAM_REF")
NEW_DATE=$(date +%Y-%m-%d)

# Try to get a version tag near the upstream HEAD
NEW_VERSION=$(git describe --tags --abbrev=0 "$UPSTREAM_REF" 2>/dev/null || echo "unknown")

cat > "$VERSION_FILE" <<EOF
upstream: element-hq/element-web
base_ref: ${NEW_BASE:0:7}
base_version: $NEW_VERSION
last_sync: $NEW_DATE
EOF

info "Updated fray/VERSION:"
cat "$VERSION_FILE"
echo ""
info "Sync complete. Review changes, then commit and push when ready."
