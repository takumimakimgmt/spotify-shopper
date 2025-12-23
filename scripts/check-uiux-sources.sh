#!/usr/bin/env bash
set -euo pipefail

# URLそのものだけ禁止（"next" や ".next" を誤爆させない）
DENY_RE='https?://|www\.|127\.0\.0\.1|nextjs\.org|open\.spotify\.com'

# staged のテキストだけ走査（バイナリは無視）
files="$(git diff --cached --name-only --diff-filter=ACMR)"
[ -z "$files" ] && exit 0

fail=0
while IFS= read -r f; do
  [ -f "$f" ] || continue
  # grep互換のため rg を使う（ヒットしたら該当行番号を出す）
  if rg -n "$DENY_RE" "$f" >/tmp/url_hit_one.txt 2>/dev/null; then
    echo "❌ Non-allowlisted URL in staged file: $f"
    cat /tmp/url_hit_one.txt
    fail=1
  fi
done <<<"$files"

exit "$fail"
