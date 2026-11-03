import type { PlaylistRow, ResultState } from "../types";
import { STORAGE_KEYS, MAX_HISTORY_BYTES } from "./keys";
const STORAGE_RESULTS = STORAGE_KEYS.history;

// --- Robust localStorage restore utilities ---
export function safeJsonParse<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

export function normalizeStoredResults(
  parsed: unknown,
): Array<[string, ResultState]> | null {
  if (!isRecord(parsed)) return null;

  // v3 stores full rows; legacy v2 summary-only records require a fresh ownership check.
  if (
    (parsed.version === 2 || parsed.version === 3) &&
    Array.isArray(parsed.results)
  ) {
    const out: Array<[string, ResultState]> = [];
    for (const r of parsed.results) {
      if (!isRecord(r)) return null;
      const url = typeof r?.url === "string" ? r.url : null;
      if (!url) return null;
      const s: Partial<ResultState> = isRecord(r.summary) ? r.summary : {};
      const validSnapshot =
        parsed.version === 3 &&
        Array.isArray(r.tracks) &&
        r.tracks.every(isPlaylistRow);
      if (parsed.version === 3 && !validSnapshot) return null;
      const trustedOwnership =
        validSnapshot && s.meta?.ownership_rules_version === 3;
      out.push([
        url,
        {
          title: typeof s.title === "string" ? s.title : "Saved playlist",
          total:
            typeof s.total === "number" && Number.isFinite(s.total)
              ? s.total
              : 0,
          playlistUrl: typeof s.playlistUrl === "string" ? s.playlistUrl : url,
          playlist_id: s.playlist_id,
          playlist_name: s.playlist_name,
          analyzedAt:
            typeof s.analyzedAt === "number" && Number.isFinite(s.analyzedAt)
              ? s.analyzedAt
              : Date.now(),
          hasRekordboxData: trustedOwnership && !!s.hasRekordboxData,
          rekordboxMeta: trustedOwnership ? (s.rekordboxMeta ?? null) : null,
          meta: s.meta,
          errorText: s.errorText ?? null,
          tracks: validSnapshot
            ? (r.tracks as PlaylistRow[]).map((t: PlaylistRow) => ({
                ...t,
                owned:
                  trustedOwnership && typeof t.owned === "boolean"
                    ? t.owned
                    : null,
                ownedReason: trustedOwnership ? t.ownedReason : null,
                libraryMatch: trustedOwnership ? t.libraryMatch : null,
              }))
            : [],
        },
      ]);
    }
    return out;
  }

  // legacy: { results: [[url, resultState], ...] }
  if (Array.isArray(parsed.results) && Array.isArray(parsed.results[0])) {
    const out: Array<[string, ResultState]> = [];
    for (const pair of parsed.results) {
      if (!Array.isArray(pair)) return null;
      const url = typeof pair?.[0] === "string" ? pair[0] : null;
      const r: Partial<ResultState> = isRecord(pair[1]) ? pair[1] : {};
      if (!url) return null;
      out.push([
        url,
        {
          title: r.title ?? "",
          total:
            typeof r.total === "number" && Number.isFinite(r.total)
              ? r.total
              : 0,
          playlistUrl: r.playlistUrl ?? url,
          playlist_id: r.playlist_id,
          playlist_name: r.playlist_name,
          analyzedAt:
            typeof r.analyzedAt === "number" && Number.isFinite(r.analyzedAt)
              ? r.analyzedAt
              : Date.now(),
          hasRekordboxData: false,
          rekordboxMeta: null,
          meta: r.meta,
          errorText: r.errorText ?? null,
          tracks: Array.isArray(r.tracks)
            ? (r.tracks as PlaylistRow[]).map((t: PlaylistRow) => ({
                ...t,
                owned: null,
                ownedReason: null,
                libraryMatch: null,
              }))
            : [],
        },
      ]);
    }
    return out;
  }

  return null;
}

export function restoreResultsFromStorage(storage: {
  getItem(k: string): string | null;
  removeItem(k: string): void;
}): Array<[string, ResultState]> | null {
  const saved = storage.getItem(STORAGE_RESULTS);
  if (!saved) return null;
  const parsed = safeJsonParse<unknown>(saved);
  const restored = normalizeStoredResults(parsed);
  if (restored && restored.length > 0) return restored;
  // Keep malformed data available for recovery; only an explicit reset removes it.
  return null;
}

export function serializeAnalysisHistory(
  entries: Array<[string, ResultState]>,
): string {
  const results = entries.map(([url, result]) => {
    const { tracks, ...summary } = result;
    return { url, tracks, summary };
  });
  const payload = JSON.stringify({ version: 3, results });
  if (new Blob([payload]).size > MAX_HISTORY_BYTES)
    throw new Error(
      "Analysis history exceeds the 2 MB local snapshot limit. Clear older analyses before closing this page.",
    );
  return payload;
}

export function saveAnalysisHistory(
  entries: Array<[string, ResultState]>,
): void {
  if (!entries.length) window.localStorage.removeItem(STORAGE_RESULTS);
  else
    window.localStorage.setItem(
      STORAGE_RESULTS,
      serializeAnalysisHistory(entries),
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function isPlaylistRow(value: unknown): value is PlaylistRow {
  return (
    isRecord(value) &&
    typeof value.title === "string" &&
    typeof value.artist === "string" &&
    typeof value.album === "string" &&
    Number.isInteger(value.index) &&
    isRecord(value.stores)
  );
}
