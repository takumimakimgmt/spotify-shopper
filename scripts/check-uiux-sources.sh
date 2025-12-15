#!/usr/bin/env bash
set -euo pipefail

ALLOW_FILE="./_teacher_data/uiux/sources/README.md"
if [ ! -f "$ALLOW_FILE" ]; then
  echo "⚠ Allowlist not found: $ALLOW_FILE (skipping URL check)" >&2
  exit 0
fi

# 変更されたmd/tsx/ts からURL抽出（プレースホルダーやローカルホストは除外）
FILES=$(git diff --cached --name-only | grep -E '\.(md|tsx|ts)$' || true)
[ -z "$FILES" ] && exit 0

URLS=$(git diff --cached $FILES | grep -Eo 'https?://[^ )"]+' | \
  grep -v 'localhost\|127\.0\.0\|placeholder\|example\.com\|\.\.\.&#10' || true)
[ -z "$URLS" ] && exit 0

# allowlist本文に載ってるドメイン/名前のいずれかが含まれてるかのチェック
BAD=0
while read -r u; do
  if ! grep -qiE 'gov\.uk|w3\.org|w3c|nngroup\.com|developer\.apple\.com|support\.apple\.com|material\.io' <<<"$u"; then
    echo "❌ Non-allowlisted URL in staged changes: $u"
    BAD=1
  fi
done <<<"$URLS"

exit $BAD
