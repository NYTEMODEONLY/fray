#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-full}"

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "gitleaks is required. Install it first (for macOS: brew install gitleaks)." >&2
  exit 1
fi

case "$MODE" in
  staged)
    echo "Running staged secret scan..."
    gitleaks git --staged --redact
    ;;
  full)
    echo "Running full-history secret scan..."
    gitleaks git . --log-opts="--all" --redact
    ;;
  *)
    echo "Usage: scripts/scan-secrets.sh [full|staged]" >&2
    exit 1
    ;;
esac
