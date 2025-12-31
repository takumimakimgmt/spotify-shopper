#!/usr/bin/env bash
set -euo pipefail

# URL denylist (tight)
DENY_RE='https?://|www\.|open\.spo|127\.0\.0\.1|nextjs\.org'

# Ignore lockfiles (they contain registry URLs by design)
IGNORE_RE='^(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|npm-shrinkwrap\.json)$'

has_rg() { command -v rg >/dev/null 2>&1; }

scan_staged() {
  local f="$1"
  if has_rg; then
    git show ":$f" | rg -n "$DENY_RE" || return 1
  else
    git show ":$f" | grep -nE "$DENY_RE" || return 1
  fi
}

# Scan exactly what is staged (index), not working tree
git diff --cached --name-only -z --diff-filter=ACMR |
  while IFS= read -r -d '' f; do

    case "$f" in
      next-env.d.ts|package-lock.json|pnpm-lock.yaml|yarn.lock) continue ;;
    esac
    [[ "$f" =~ $IGNORE_RE ]] && continue

    if scan_staged "$f"; then
      echo "❌ Non-allowlisted URL in staged file: $f"
      scan_staged "$f" | head -50
      exit 1
    fi
  done

echo "OK: uiux URL check passed"
