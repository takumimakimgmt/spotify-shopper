#!/usr/bin/env bash
set -euo pipefail

TARGET_RE='^_teacher_data/uiux/'
ALLOWLIST_FILE='_teacher_data/uiux/sources/README.md'
IGNORE_RE='^(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|npm-shrinkwrap\.json)$'
URL_RE='https?://[^[:space:])"]+'

has_rg() { command -v rg >/dev/null 2>&1; }

die() { echo "$*" >&2; exit 1; }

extract_urls() {
  local file="$1"
  if has_rg; then
    rg -o "$URL_RE" "$file" || true
  else
    grep -Eo "$URL_RE" "$file" || true
  fi
}

extract_urls_from_staged() {
  local f="$1"
  if has_rg; then
    git show ":$f" | rg -n -o "$URL_RE" || true
  else
    git show ":$f" | grep -nEo "$URL_RE" || true
  fi
}

url_host() {
  # https://example.com/path -> example.com
  echo "$1" | sed -E 's#^https?://([^/]+).*#\1#'
}

extract_extra_domains_block() {
  # READMEの「追加許可ドメイン（実装上の固定URL）」ブロックからドメイン行だけ抜く
  # 例: open.spotify.com
  awk '
    BEGIN{in=0}
    /追加許可ドメイン（実装上の固定URL）/{in=1; next}
    in==1 && /^---/{exit}
    in==1 && $0 ~ /^[a-z0-9.-]+$/ {print}
  ' "$ALLOWLIST_FILE" 2>/dev/null || true
}

main() {
  [[ -f "$ALLOWLIST_FILE" ]] || die "Allowlist file missing: $ALLOWLIST_FILE"

  local staged
  staged="$(git diff --cached --name-only -z --diff-filter=ACMR | tr '\0' '\n' || true)"

  # 対象だけに絞る
  local targets
  targets="$(echo "$staged" | grep -E "$TARGET_RE" || true)"

  if [[ -z "$targets" ]]; then
    echo "OK: uiux URL check skipped (no staged files under _teacher_data/uiux/)"
    exit 0
  fi

  local allow_urls_tmp allow_hosts_tmp
  allow_urls_tmp="$(mktemp)"
  allow_hosts_tmp="$(mktemp)"
  trap 'rm -f "$allow_urls_tmp" "$allow_hosts_tmp"' EXIT

  # allowlisted URLs (exact)
  extract_urls "$ALLOWLIST_FILE" | sed -E 's/[.,]$//' | sort -u > "$allow_urls_tmp"

  # allowlisted hosts:
  # - hosts from allowlisted URLs
  # - extra domains block
  {
    while IFS= read -r u; do
      [[ -z "$u" ]] && continue
      url_host "$u"
    done < "$allow_urls_tmp"
    extract_extra_domains_block
  } | sed -E 's/[[:space:]]+//g' | grep -E '^[a-z0-9.-]+$' | sort -u > "$allow_hosts_tmp"

  local failed=0

  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    [[ "$f" =~ $IGNORE_RE ]] && continue
    [[ ! "$f" =~ $TARGET_RE ]] && continue

    # staged file内の URL を “行番号:URL” 形式で拾う
    local hits
    hits="$(extract_urls_from_staged "$f" || true)"
    [[ -z "$hits" ]] && continue

    while IFS= read -r hit; do
      [[ -z "$hit" ]] && continue
      # hit 例: "12:https://example.com"
      local url
      url="$(echo "$hit" | sed -E 's/^[0-9]+://')"
      url="$(echo "$url" | sed -E 's/[.,]$//')"

      local host
      host="$(url_host "$url")"

      if grep -Fxq "$url" "$allow_urls_tmp"; then
        continue
      fi
      if grep -Fxq "$host" "$allow_hosts_tmp"; then
        continue
      fi

      echo "❌ Non-allowlisted URL in staged file: $f"
      echo "$hit"
      failed=1
      break
    done <<< "$hits"

    [[ "$failed" -eq 1 ]] && break
  done <<< "$targets"

  if [[ "$failed" -eq 1 ]]; then
    exit 1
  fi

  echo "OK: uiux URL check passed (scoped to _teacher_data/uiux/)"
}

main "$@"
