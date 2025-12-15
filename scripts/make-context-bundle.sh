#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$(date +"%Y%m%d_%H%M%S")"
OUT_DIR="$ROOT/_context"
RUN_DIR="$OUT_DIR/web_${STAMP}"
ARCHIVE="$OUT_DIR/spotify-shopper-web_context_${STAMP}.tgz"

mkdir -p "$RUN_DIR"

echo "==> ROOT: $ROOT" | tee "$RUN_DIR/00_meta.txt"
echo "==> STAMP: $STAMP" | tee -a "$RUN_DIR/00_meta.txt"

# ---- Git snapshots (read-only) ----
(
  cd "$ROOT"
  echo "## git status" > "$RUN_DIR/10_git_status.txt"
  git status -sb >> "$RUN_DIR/10_git_status.txt" 2>&1 || true

  echo "## git log" > "$RUN_DIR/11_git_log.txt"
  git log --oneline -30 >> "$RUN_DIR/11_git_log.txt" 2>&1 || true

  echo "## git diff (working tree)" > "$RUN_DIR/12_git_diff.patch"
  git diff >> "$RUN_DIR/12_git_diff.patch" 2>&1 || true

  echo "## git diff --cached (staged)" > "$RUN_DIR/13_git_diff_cached.patch"
  git diff --cached >> "$RUN_DIR/13_git_diff_cached.patch" 2>&1 || true
) || true

# ---- Directory / file inventory ----
(
  cd "$ROOT"
  echo "## tree (depth=4)" > "$RUN_DIR/20_tree.txt"
  if command -v tree >/dev/null 2>&1; then
    tree -L 4 -a -I "node_modules|.next|dist|coverage|.git|.vercel|_context|_teacher_data" >> "$RUN_DIR/20_tree.txt"
  else
    find . -maxdepth 4 \
      -not -path "./node_modules/*" \
      -not -path "./.next/*" \
      -not -path "./dist/*" \
      -not -path "./coverage/*" \
      -not -path "./.git/*" \
      -not -path "./.vercel/*" \
      -not -path "./_context/*" \
      -not -path "./_teacher_data/*" \
      -print >> "$RUN_DIR/20_tree.txt"
  fi

  echo "## key files list" > "$RUN_DIR/21_key_files.txt"
  ls -la app/page.tsx app/components 2>/dev/null >> "$RUN_DIR/21_key_files.txt" || true
  ls -la lib/state/usePlaylistAnalyzer.ts lib/types.ts lib/constants.ts 2>/dev/null >> "$RUN_DIR/21_key_files.txt" || true
) || true

# ---- Focused grep reports (labels/UX issues) ----
(
  cd "$ROOT"
  echo "## wording scan" > "$RUN_DIR/30_wording_scan.txt"
  if command -v rg >/dev/null 2>&1; then
    rg -n "fetch|fetching|parse|parsing|Checkout|checkout|cache_hit|refresh|Fetched in|ms\\b|Coverage|appleNotice|Apple Music" app lib \
      >> "$RUN_DIR/30_wording_scan.txt" || true
  else
    grep -R -nE 'fetch|fetching|parse|parsing|Checkout|checkout|cache_hit|refresh|Fetched in|ms\b|Coverage|appleNotice|Apple Music' app lib \
      >> "$RUN_DIR/30_wording_scan.txt" 2>/dev/null || true
  fi
) || true

# ---- Copy key files (for quick review) ----
mkdir -p "$RUN_DIR/files"
cp -f "$ROOT/app/page.tsx" "$RUN_DIR/files/" 2>/dev/null || true
cp -f "$ROOT/app/components/AnalyzeForm.tsx" "$RUN_DIR/files/" 2>/dev/null || true
cp -f "$ROOT/app/components/ProgressList.tsx" "$RUN_DIR/files/" 2>/dev/null || true
cp -f "$ROOT/app/components/ResultSummaryBar.tsx" "$RUN_DIR/files/" 2>/dev/null || true
cp -f "$ROOT/lib/state/usePlaylistAnalyzer.ts" "$RUN_DIR/files/" 2>/dev/null || true
cp -f "$ROOT/lib/types.ts" "$RUN_DIR/files/" 2>/dev/null || true
cp -f "$ROOT/lib/constants.ts" "$RUN_DIR/files/" 2>/dev/null || true

# ---- Create tgz (macOS tar without --transform) ----
(
  cd "$ROOT"
  TMP_DIR=$(mktemp -d)
  trap "rm -rf $TMP_DIR" EXIT
  
  # Create a temporary copy with desired structure
  mkdir -p "$TMP_DIR/spotify-shopper-web"
  
  # Copy files excluding unwanted dirs
  rsync -av --exclude=.next --exclude=node_modules --exclude=dist --exclude=coverage \
    --exclude=.git --exclude=.vercel --exclude=_context --exclude=_teacher_data \
    --exclude=.env --exclude=.env.* --exclude=.DS_Store --exclude="*.log" \
    . "$TMP_DIR/spotify-shopper-web/" 2>/dev/null || true
  
  # Create tar in temp dir
  cd "$TMP_DIR"
  tar -czf "$ARCHIVE" spotify-shopper-web/
  cd "$ROOT"
)

# ---- Print result ----
echo ""
echo "✅ Wrote snapshot dir: $RUN_DIR"
echo "✅ Wrote archive     : $ARCHIVE"
echo ""
if [ -f "$ARCHIVE" ]; then
  echo "Archive size: $(du -h "$ARCHIVE" | cut -f1)"
  echo "SHA256:"
  shasum -a 256 "$ARCHIVE" || true
fi
