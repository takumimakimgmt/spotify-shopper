#!/usr/bin/env bash
set -euo pipefail

ALLOWLIST_FILE="${ALLOWLIST_FILE:-docs/uiux_sources_allowlist.txt}"

# allowlist domains (1行1ドメイン想定) を読む。無ければ空でOK
ALLOWLIST_DOMAINS=""
if [[ -f "$ALLOWLIST_FILE" ]]; then
  ALLOWLIST_DOMAINS="$(cat "$ALLOWLIST_FILE")"
fi

# stagedで追加/変更されたファイルのみ（ACM）
files=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(md|ts|tsx)$' || true)

bad=0
for f in $files; do
  # stagedの最終内容をチェック（diffじゃなくて index の中身）
  urls=$(git show ":$f" 2>/dev/null | grep -oE 'https?://[^ )"\t]+' || true)
  if [[ -z "$urls" ]]; then
    continue
  fi

  while IFS= read -r u; do
    domain=$(echo "$u" | sed -E 's#https?://([^/]+).*#\1#')
    if [[ -n "$ALLOWLIST_DOMAINS" ]] && echo "$ALLOWLIST_DOMAINS" | grep -qx "$domain"; then
      continue
    fi
    echo "❌ Non-allowlisted URL in staged content: $u"
    bad=1
  done <<< "$urls"
done

exit $bad
