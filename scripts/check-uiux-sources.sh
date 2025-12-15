#!/usr/bin/env bash
set -euo pipefail

ALLOW_FILE="./_teacher_data/uiux/sources/README.md"
if [ ! -f "$ALLOW_FILE" ]; then
  echo "Missing allowlist: $ALLOW_FILE" >&2
  exit 1
fi

# 変更されたmd/tsx/ts からURL抽出（必要なら拡張）
FILES=$(git diff --cached --name-only | grep -E '\.(md|tsx|ts)$' || true)
[ -z "$FILES" ] && exit 0

URLS=$(git diff --cached $FILES | grep -Eo 'https?://[^ )"]+' | sort -u || true)
[ -z "$URLS" ] && exit 0

# allowlist本文に載ってるドメイン/名前のいずれかが含まれてるかの雑チェック（最小）
BAD=0
while read -r u; do
  if ! grep -qiE 'gov\.uk|w3\.org|w3c|nngroup|apple\.com|material\.io' "$ALLOW_FILE"; then
    echo "Allowlist seems missing domain patterns; edit README.md" >&2
    exit 1
  fi
  if ! grep -qiE 'gov\.uk|w3\.org|nngroup\.com|developer\.apple\.com|support\.apple\.com|material\.io' <<<"$u"; then
    echo "❌ Non-allowlisted URL in staged changes: $u"
    BAD=1
  fi
done <<<"$URLS"

exit $BAD
