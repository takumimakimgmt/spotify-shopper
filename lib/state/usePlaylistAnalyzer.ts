"use client";
import { normalizeMeta, normalizeTracks } from "../api/normalize";
import { ENABLE_APPLE_MUSIC } from "@/lib/config/features";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function getProp(obj: unknown, key: string): unknown {
  return isRecord(obj) ? obj[key] : undefined;
}

function getStringProp(obj: unknown, key: string): string | undefined {
  const v = getProp(obj, key);
  return typeof v === "string" ? v : undefined;
}

const APPLE_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_APPLE_TIMEOUT_MS ?? '120000');



// --- Music feature flag ---
const _ENABLE_APPLE = process.env.NEXT_PUBLIC_ENABLE_APPLE === '1';

// --- Robust localStorage restore utilities ---
function safeJsonParse<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function normalizeStoredResults(parsed: any): Array<[string, ResultState]> | null {
  if (!parsed) return null;

  // v2: { version: 2, results: [{ url, summary: {...} }] }
  if (parsed.version === 2 && Array.isArray(parsed.results)) {
    const out: Array<[string, ResultState]> = [];
    for (const r of parsed.results) {
      const url = typeof r?.url === 'string' ? r.url : null;
      if (!url) continue;
      const s = r?.summary ?? {};
      out.push([
        url,
        {
          title: s.title ?? '',
          total: Number.isFinite(s.total) ? s.total : 0,
          playlistUrl: s.playlistUrl ?? url,
          playlist_id: s.playlist_id,
          playlist_name: s.playlist_name,
          analyzedAt: Number.isFinite(s.analyzedAt) ? s.analyzedAt : Date.now(),
          hasRekordboxData: !!s.hasRekordboxData,
          rekordboxMeta: s.rekordboxMeta ?? null,
          meta: s.meta,
          errorText: s.errorText ?? null,
          tracks: [], // Always array
        },
      ]);
    }
    return out;
  }

  // legacy: { results: [[url, resultState], ...] }
  if (Array.isArray(parsed.results) && Array.isArray(parsed.results[0])) {
    const out: Array<[string, ResultState]> = [];
    for (const pair of parsed.results) {
      const url = typeof pair?.[0] === 'string' ? pair[0] : null;
      const r = pair?.[1] ?? {};
      if (!url) continue;
      out.push([
        url,
        {
          title: r.title ?? '',
          total: Number.isFinite(r.total) ? r.total : 0,
          playlistUrl: r.playlistUrl ?? url,
          playlist_id: r.playlist_id,
          playlist_name: r.playlist_name,
          analyzedAt: Number.isFinite(r.analyzedAt) ? r.analyzedAt : Date.now(),
          hasRekordboxData: !!r.hasRekordboxData,
          rekordboxMeta: r.rekordboxMeta ?? null,
          meta: r.meta,
          errorText: r.errorText ?? null,
          tracks: Array.isArray(r.tracks) ? r.tracks : [], // Always array
        },
      ]);
    }
    return out;
  }

  return null;
}

import type { RekordboxMeta } from "../types";
import type { ApiMeta } from "../types";
// RekordboxMeta utility
const makeRekordboxMeta = (file: File | null): RekordboxMeta | null =>
  file ? { filename: file.name, updatedAtISO: new Date(file.lastModified).toISOString() } : null;

import { useEffect, useRef, useState, ChangeEvent, FormEvent } from 'react';
import { PlaylistRow, ResultState, TrackCategory, PlaylistSnapshotV1 } from "../types";
import { canonicalizeKey } from "@/lib/utils/normalize";
import {
  getPlaylist,
  postPlaylistWithRekordboxUpload,
  matchSnapshotWithXml,
} from '../api/playlist';
import { detectSourceFromUrl, sanitizeUrl } from '../utils/playlistUrl';

const STORAGE_RESULTS = 'spotify-shopper-results';
const MAX_STORAGE_BYTES = 300 * 1024; // ~300KB guard

const ENABLE_LOCAL_PERSIST = false;
type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};
const safeStorage: StorageLike = {
  getItem: (k) => (ENABLE_LOCAL_PERSIST ? safeStorage.getItem(k) : null),
  setItem: (k, v) => { if (ENABLE_LOCAL_PERSIST) safeStorage.setItem(k, v); },
  removeItem: (k) => { if (ENABLE_LOCAL_PERSIST) safeStorage.removeItem(k); },
};

export function categorizeTrack(track: PlaylistRow): TrackCategory {
  if (track.owned === true) return 'owned';
  return 'checkout';
}

function mapTracks(rows: PlaylistRow[]): PlaylistRow[] { return rows; }const _sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function classifyAppleError(message: string | undefined): 'timeout' | 'dom-change' | 'region' | 'bot-suspected' | 'unknown' {
  if (!message) return 'unknown';
  const lower = message.toLowerCase();
  if (lower.includes('timeout') || lower.includes('timed out')) return 'timeout';
  if (lower.includes('selector') || lower.includes('element not found') || lower.includes('dom')) return 'dom-change';
  if (lower.includes('region') || lower.includes('country') || lower.includes('market')) return 'region';
  if (lower.includes('bot') || lower.includes('captcha') || lower.includes('suspicious')) return 'bot-suspected';
  return 'unknown';
}

export function usePlaylistAnalyzer() {
        // タブ切替時にtracks未定義ならAPIでhydrate
        const _ensureHydrated = async (url: string) => {
          const idx = multiResults.findIndex(([u]) => u === url);
          if (idx === -1) return;
          const [_, result] = multiResults[idx];
          if (result.tracks && result.tracks.length > 0) return;
          try {
            setMultiResults((prev) =>
              prev.map(([u, r]) =>
                u === url ? [u, { ...r, tracks: [] }] : [u, r]
              )
            );
            const detectedSource = detectSourceFromUrl(url);
            const json = await getPlaylist({ url, source: detectedSource });
            const rows = mapTracks(normalizeTracks(json));
            setMultiResults((prev) =>
              prev.map(([u, r]) =>
                u === url ? [u, { ...r, tracks: rows, analyzedAt: Date.now() }] : [u, r]
              )
            );
          } catch (_err) {
            setMultiResults((prev) =>
              prev.map(([u, r]) =>
                u === url ? [u, { ...r, errorText: 'トラックの取得に失敗しました', tracks: [] }] : [u, r]
              )
            );
          }
        };

      // Robust restore: always arrayify tracks, auto-discard broken/legacy data
      useEffect(() => {
        try {
          if (typeof window === 'undefined') return;
          const saved = safeStorage.getItem(STORAGE_RESULTS);
          if (!saved) return;
          const parsed = safeJsonParse<any>(saved);
          const restored = normalizeStoredResults(parsed);
          if (restored && restored.length > 0) {
            setMultiResults(restored);
          } else {
            // Broken or unrecognized format: auto-discard
            safeStorage.removeItem(STORAGE_RESULTS);
          }
        } finally {
        }
      }, []);

      // 1-1: STORAGE_RESULTSへ保存時はtracksを絶対に含めない
      function _saveResultsToStorage(results: Array<[string, ResultState]>) {
        if (typeof window === 'undefined') return;
        // tracksを除外したLightResultのみ保存
        const lightResults = results.map(([url, r]) => [
          url,
          {
            title: r.title,
            total: r.total,
            playlistUrl: r.playlistUrl,
            playlist_id: r.playlist_id,
            playlist_name: r.playlist_name,
            analyzedAt: r.analyzedAt,
            hasRekordboxData: r.hasRekordboxData,
            rekordboxMeta: r.rekordboxMeta,
            meta: r.meta,
            // tracksは絶対に保存しない
          }
        ]);
        safeStorage.setItem(STORAGE_RESULTS, JSON.stringify({ results: lightResults }));
      }

  const [playlistUrlInput, setPlaylistUrlInput] = useState('');
  const [rekordboxFile, setRekordboxFile] = useState<File | null>(null);
  const [rekordboxDate, setRekordboxDate] = useState<string | null>(null);
  const [multiResults, setMultiResults] = useState<Array<[string, ResultState]>>([]);
  const [loading, setLoading] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!multiResults.length) return;
    if (localStorageDebounceRef.current) clearTimeout(localStorageDebounceRef.current);
    localStorageDebounceRef.current = setTimeout(() => {
      // summary-only: url, snapshotId, summaryのみ
      const results = multiResults.map(([url, r]) => ({
        url,
        snapshotId: r.playlist_id,
        summary: {
          title: r.title,
          total: r.total,
          playlistUrl: r.playlistUrl,
          playlist_id: r.playlist_id,
          playlist_name: r.playlist_name,
          analyzedAt: r.analyzedAt,
          hasRekordboxData: r.hasRekordboxData,
          rekordboxMeta: r.rekordboxMeta,
          meta: r.meta,
        }
      }));
      const payload = JSON.stringify({ version: 2, results });
      if (payload.length > MAX_STORAGE_BYTES) {
        setStorageWarning('保存容量上限を超えました');
        return;
      }
      safeStorage.setItem(STORAGE_RESULTS, payload);
    }, 500);
  }, [multiResults]);

  // rekordboxファイルと日付をセットで管理する共通関数
  const applyRekordboxFile = (file: File | null) => {
    setRekordboxFile(file);
    if (file && typeof file.lastModified === 'number') {
      const date = new Date(file.lastModified);
      setRekordboxDate(date.toLocaleString());
    } else {
      setRekordboxDate(null);
    }
  };
  const [progress, setProgress] = useState<number>(0);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [errorMeta, setErrorMeta] = useState<any>(null);
  const [forceRefreshHint, setForceRefreshHint] = useState(false);
  const [reAnalyzeUrl, setReAnalyzeUrl] = useState<string | null>(null);
  // Progress items for per-URL status visualization
  type ProgressStatus = 'pending' | 'fetching' | 'parsing' | 'done' | 'error';
  const [progressItems, setProgressItems] = useState<Array<{ url: string; status: ProgressStatus; message?: string }>>([]);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [phaseLabel, setPhaseLabel] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<number>(0);
  const progressTimer = useRef<number | null>(null);
  const reAnalyzeInputRef = useRef<HTMLInputElement | null>(null);
  const localStorageDebounceRef = useRef<NodeJS.Timeout | null>(null);


  const clearLocalData = () => {
    try {
      safeStorage.removeItem(STORAGE_RESULTS);
      setMultiResults([]);
      setPlaylistUrlInput('');
      applyRekordboxFile(null);
      setStorageWarning(null);
    } catch (_err) {
      console.error('[Storage] Failed to clear local data:', _err);
      setStorageWarning('Failed to clear local data.');
    }
  };

  // selectedKey is managed by selection, not analyzer
  // currentResult is now derived in viewModel

  // (formCollapsed is now managed only by selection)

  
const isProcessing = loading || isReanalyzing;

  useEffect(() => {
    if (!isProcessing || progressItems.length === 0) {
      setProgress(0);
      return;
    }

    const weights: Record<string, number> = {
      pending: 0,
      fetching: 0.35,
      parsing: 0.75,
      done: 1,
      error: 1,
    };

    const avg =
      progressItems.reduce((acc, item) => acc + (weights[item.status] ?? 0), 0) /
      progressItems.length;

    setProgress(Math.max(0, Math.min(100, Math.round(avg * 100))));
  }, [isProcessing, progressItems]);

  const handleRekordboxChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    applyRekordboxFile(file);
  };

  const handleRemoveTab = (urlToRemove: string) => {
    setMultiResults((prev) => prev.filter(([url]) => url !== urlToRemove));
  };

  const handleReAnalyzeFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Re-analyze/BulkでもXML日時を更新
    applyRekordboxFile(file);
    const isBulk = reAnalyzeUrl === '__BULK__';
    setIsReanalyzing(true);
    setLoading(false);
    setErrorText(null);

    try {
      if (isBulk) {
        const updatedResults: Array<[string, ResultState]> = [];
        for (const [url, result] of multiResults) {
          try {
            const detectedSource = detectSourceFromUrl(url);
            const json = await postPlaylistWithRekordboxUpload({
              url,
              source: detectedSource,
              file,
            });
            const rows = mapTracks(normalizeTracks(json));
            updatedResults.push([
              url,
              { ...result, tracks: rows, analyzedAt: Date.now(), hasRekordboxData: true, rekordboxMeta: makeRekordboxMeta(file) },
            ]);
          } catch (_err) {
            console.error(`[Bulk Re-analyze] Error for ${url}:`, _err);
            updatedResults.push([url, result]);
          }
        }
        setMultiResults(updatedResults);
        setErrorText(null);
        return;
      }

      if (!reAnalyzeUrl) {
        setErrorText('プレイリストURLが見つかりません');
        return;
      }
      const existingResult = multiResults.find(([url]) => url === reAnalyzeUrl)?.[1];
      if (!existingResult) {
        setErrorText('プレイリストが見つかりません');
        return;
      }

      const detectedSource = detectSourceFromUrl(reAnalyzeUrl);
      const json = await postPlaylistWithRekordboxUpload({
        url: reAnalyzeUrl,
        source: detectedSource,
        file,
      });
      const rows = mapTracks(normalizeTracks(json));
      setMultiResults((prev) =>
        prev.map(([url, result]) =>
          url === reAnalyzeUrl
            ? [
                url,
                {
                  ...result,
                  tracks: rows,
                  analyzedAt: Date.now(),
                  hasRekordboxData: true,
                  rekordboxMeta: makeRekordboxMeta(file),
                },
              ]
            : [url, result]
        )
      );
      setErrorText(null);
    } catch (_err) {
      console.error('[Re-analyze] Error:', _err);
      setErrorText('XML照合中にエラーが発生しました');
    } finally {
      setIsReanalyzing(false);
      setReAnalyzeUrl(null);
      if (reAnalyzeInputRef.current) reAnalyzeInputRef.current.value = '';
    }
  };

  const handleAnalyze = async (e: FormEvent) => {
    e.preventDefault();
    setErrorText(null);
    setPhaseLabel('Preparing');
    // Use forceRefreshHint from state (set by button onClick) instead of unreliable FormEvent.shiftKey
    const isForceRefresh = forceRefreshHint;
    if (isForceRefresh) {
      window.setTimeout(() => setForceRefreshHint(false), 2000);
    }

    const urls = playlistUrlInput
      .split('\n')
      .map((line) => sanitizeUrl(line))
      .filter((url) => url.length > 0);
    if (urls.length === 0) {
      setErrorText('Please enter at least one playlist URL or ID.');
      setPhaseLabel(null);
      return;
    }

    // Initialize progress items for each URL
    setProgressItems(urls.map((url) => ({ url, status: 'pending' as ProgressStatus })));

    if (abortRef.current) {
      try { abortRef.current.abort(); } catch {}
    }
    abortRef.current = new AbortController();
    const localRequestId = requestIdRef.current + 1;
    requestIdRef.current = localRequestId;

    setLoading(true);
    setProgress(0);
    if (progressTimer.current) {
      window.clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
const newResults: Array<[string, ResultState]> = [];
    let hasError = false;

    for (const url of urls) {

      let effectiveSource = 'spotify' as const;
      try {
        const t0 = performance.now();
        const t1_start = t0;
        effectiveSource = 'spotify';
        const isApplePlaylistUrl = /music\.apple\.com\//i.test(url);
        if (isApplePlaylistUrl) {
          effectiveSource = 'spotify';
        }
        setPhaseLabel('Fetching Spotify');
        setProgressItems((prev) =>
          prev.map((p) =>
            p.url === url
              ? {
                  ...p,
                  status: 'fetching',
                  message: isForceRefresh ? 'Reloading' : 'Loading',
                }
              : p
          )
        );

        const isSpotifyPlaylistUrl = /open\.spotify\.com\/.*playlist\//i.test(url);
        const isSpotifyUri = /^spotify:playlist:[A-Za-z0-9]{22}$/i.test(url);
        const isIdOnly = /^[A-Za-z0-9]{22}$/.test(url);
        if (!isSpotifyPlaylistUrl && !isSpotifyUri && !isIdOnly) {
          hasError = true;
          continue;
        }

        const t2_api_start = performance.now();
        let json: unknown | null = null;

        const fetchOnce = async () => {
          if (rekordboxFile) {
            return postPlaylistWithRekordboxUpload({
              url,
              source: effectiveSource,
              file: rekordboxFile,
              refresh: isForceRefresh,
              signal: abortRef.current?.signal ?? undefined,
            });
          }
          return getPlaylist({
            url,
            source: effectiveSource,
            refresh: isForceRefresh,
            signal: abortRef.current?.signal ?? undefined,
          });
        };

        // Musicはautoモード1回のみ（backendでfast/legacy自動フォールバック）
        if (false /* apple disabled */) {
          setPhaseLabel('Fetching playlist (auto)');
          const timeoutController = new AbortController();
          const timeoutId = setTimeout(() => timeoutController.abort(), APPLE_TIMEOUT_MS);
try {
            json = await fetchOnce();
            clearTimeout(timeoutId);
          } catch (_err: any) {
            clearTimeout(timeoutId);
            // UI向けエラー文言を具体化
            const reasonTag = classifyAppleError(_err?.message);
            let errorMsg = '';
            switch (reasonTag) {
              case 'timeout':
                errorMsg = '取得が時間切れでした。時間をおいて再実行してください。';
                break;
              case 'dom-change':
                errorMsg = 'Apple側のDOM変更の可能性。時間を置く or URL形式を確認。';
                break;
              case 'region':
                errorMsg = '地域制限/ログイン状態の可能性。';
                break;
              case 'bot-suspected':
                errorMsg = 'bot検知の可能性。時間を置く/回数を減らす。';
                break;
              default:
                errorMsg = '取得に失敗しました。';
            }
            setErrorText(errorMsg);
            throw _err;
          }
        } else {
          json = await fetchOnce();
        }
        const t3_api_done = performance.now();

        if (localRequestId !== requestIdRef.current) {
          continue;
        }

        if (!json) {
          throw new Error('Failed to fetch playlist data');
        }

        if (rekordboxFile) {
          setPhaseLabel('Matching Rekordbox');
          setProgressItems((prev) =>
            prev.map((p) =>
              p.url === url
                ? { ...p, status: 'parsing', message: 'Matching Rekordbox' }
                : p
            )
          );
        }

        const t4_mapstart = performance.now();
        const rows = mapTracks(normalizeTracks(json));
        const t5_mapdone = performance.now();
        const api_ms = t3_api_done - t2_api_start;
        const map_ms = t5_mapdone - t4_mapstart;
        const total_ms = performance.now() - t1_start;
        const overhead_ms = Math.max(0, total_ms - api_ms - map_ms);
        const payload_bytes = new Blob([JSON.stringify(json)]).size;
        const metaWithTiming: ApiMeta = {
          ...((normalizeMeta(getProp(json, "meta")) ?? {})),
          client_total_ms: total_ms,
          client_api_ms: api_ms,
          client_map_ms: map_ms,
          client_overhead_ms: overhead_ms,
          payload_bytes,
        };
        newResults.push([
          url,
          {
            title: (getStringProp(json, "playlist_name") ?? "(unknown)"),
            total: rows.length,
            playlistUrl: (getStringProp(json, "playlist_url")) ?? url,
            playlist_id: (getStringProp(json, "playlist_id") ?? ""),
            playlist_name: (getStringProp(json, "playlist_name") ?? "(unknown)"),
            tracks: rows,
            analyzedAt: Date.now(),
            hasRekordboxData: !!rekordboxFile,
            meta: metaWithTiming,
          },
        ]);
        // Mark success
        setProgressItems((prev) =>
          prev.map((p) => (p.url === url ? { ...p, status: 'done', message: `${rows.length} tracks` } : p))
        );

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const t7_raf2 = performance.now();
            const totalMs = t7_raf2 - t1_start;
            const payloadBytes = new Blob([JSON.stringify(json)]).size;
            const api_ms = t3_api_done - t2_api_start;
            const map_ms = t5_mapdone - t4_mapstart;
            const overhead_ms = totalMs - api_ms - map_ms;
            console.log(
              `[PERF] url=${url.substring(0, 60)} tracks=${rows.length}\n` +
              `  Total: ${totalMs.toFixed(1)}ms | API: ${api_ms.toFixed(1)}ms | Map: ${map_ms.toFixed(1)}ms | Overhead: ${overhead_ms.toFixed(1)}ms\n` +
              `  Payload: ${payloadBytes} bytes | TTFB+API: ${(t3_api_done - t1_start).toFixed(1)}ms`
            );
          });
        });
      } catch (_err: any) {
        hasError = true;
        // Short error message for progress list
        const errShort = typeof _err?.message === 'string' ? _err.message : 'request failed';
        const reasonTag = false /* apple disabled */
          ? classifyAppleError(_err?.data?.detail?.error || errShort)
          : null;
        setProgressItems((prev) =>
          prev.map((p) =>
            p.url === url
              ? { ...p, status: 'error', message: reasonTag ? `${reasonTag}` : errShort }
              : p
          )
        );
        if (_err?.data?.detail) {
          const detail = _err.data.detail;
          const usedSource = typeof detail?.used_source === 'string' ? detail.used_source : undefined;
          const errText = typeof detail?.error === 'string' ? detail.error : undefined;
          const metaFromApi = detail?.meta;
          
          // Normalize empty objects to null, but always provide minimum context
          const normalizedMeta =
            metaFromApi && typeof metaFromApi === 'object' && Object.keys(metaFromApi).length > 0
              ? metaFromApi
              : null;
          
          const detectedSource = detectSourceFromUrl(url) || 'spotify';
          const minimalContext = {
            url: url.substring(0, 80),
            source: usedSource || detectedSource,
            refresh: isForceRefresh ? 1 : 0,
            reason: reasonTag || undefined,
          };
          
          setErrorMeta(normalizedMeta ?? minimalContext);
          if (usedSource === 'spotify') {
            if (errText) {
              const lower = errText.toLowerCase();
              const isPersonalized = lower.includes('personalized') || lower.includes('private') || lower.includes('daily mix') || lower.includes('blend');
              const isOfficial =
                lower.includes('official editorial') ||
                lower.includes('owner=spotify') ||
                lower.includes('region-restricted') ||
                lower.includes('region-locked') ||
                lower.includes('tried markets') ||
                lower.includes('37i9') ||
                lower.includes('create a new public playlist');
              if (isPersonalized && !isOfficial) {
                setErrorText(
                  '【日本語】\nこのSpotifyプレイリストはパーソナライズ/非公開のため、クライアントクレデンシャルでは取得できません。\nワークアラウンド: 新しい自分の公開プレイリストを作成し、元のプレイリストから全曲をコピーした上で、その新しいURLを指定してください。\n\n【English】\nThis Spotify playlist is personalized/private and cannot be accessed with client credentials.\nWorkaround: Create a new public playlist in your account, copy all tracks from the original playlist, and use the new URL.'
                );
              } else if (isPersonalized && isOfficial) {
                setErrorText(
                  '【日本語】\nこのSpotifyプレイリストは公式編集プレイリスト（37i9で始まるID）またはパーソナライズ/非公開のため、クライアントクレデンシャルでは取得できません。\nワークアラウンド: 新しい自分の公開プレイリストを作成し、元のプレイリストから全曲をコピーした上で、その新しいURLを指定してください。\n\n【English】\nThis Spotify playlist is an official editorial playlist (ID starts with 37i9) or personalized/private and cannot be accessed with client credentials.\nWorkaround: Create a new public playlist in your account, copy all tracks from the original playlist, and use the new URL.'
                );
              } else if (isOfficial) {
                setErrorText(
                  '【日本語】\nこのSpotifyの公式/編集プレイリスト（37i9で始まるID）は、地域制限や提供条件により取得できない場合があります。\nワークアラウンド: Spotifyで新しい自分の公開プレイリストを作成し、元プレイリストの曲を全てコピー、そのURLで解析してください。\n\n【English】\nThis Spotify official/editorial playlist (ID starts with 37i9) cannot be accessed due to regional restrictions or availability conditions.\nWorkaround: Create a new public playlist in Spotify, copy all tracks from the original, and use that URL for analysis.'
                );
              } else {
                setErrorText('Spotifyの取得に失敗しました / Spotify request failed: ' + errText);
              }
            } else {
              setErrorText('Spotifyの取得に失敗しました（詳細不明）');
            }
          } else {
            // 2-3: Musicエラー詳細化
            const base = errText || 'プレイリストの取得に失敗しました';
            const reasonSuffix = false /* apple disabled */ && reasonTag ? ` (${reasonTag})` : '';
            let hint = '';
            if (false /* apple disabled */) {
              if (reasonTag === 'timeout') {
                hint = '\n取得元が遅い/失敗しやすい場合があります。単体URLでRetry推奨。時間をおいて再試行してください。';
              } else if (reasonTag === 'region') {
                hint = '\n地域制限・提供条件により取得できない場合があります。';
              } else if (reasonTag === 'bot-suspected') {
                hint = '\n取得元側でbot判定・CAPTCHA等によりブロックされている可能性があります。時間をおいて再試行してください。';
              }
            }
            setErrorText(base + reasonSuffix + hint);
          }
        } else {
          const hint = reasonTag ? ` (${reasonTag})` : '';
          setErrorText(`プレイリストの取得に失敗しました${hint}`);
        }
      }
    }

    if (newResults.length > 0) {
      const rbMeta = makeRekordboxMeta(rekordboxFile);
      const existingUrls = new Set(newResults.map(([url]) => url));
      const filteredExisting = multiResults.filter(([url]) => !existingUrls.has(url));
      // 新規resultにrekordboxMetaを焼き込む
      const merged: Array<[string, ResultState]> = [
        ...newResults.map(([url, result]) => [url, { ...result, rekordboxMeta: rbMeta }] as [string, ResultState]),
        ...filteredExisting
      ];
      setMultiResults(merged);
      setPlaylistUrlInput('');
      // XMLファイル情報は消さない
      // setRekordboxFile(null);
      // setRekordboxDate(null);
    }

    if (hasError && newResults.length === 0) {
      setErrorText((prev) => prev ?? 'Failed to load playlists. Check URLs and try again.');
    }

    setProgress(100);
    setTimeout(() => setProgress(0), 600);
    setLoading(false);
    if (progressTimer.current) {
      window.clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
    setPhaseLabel(null);
  };

  const applySnapshotWithXml = async (
    file: File,
    currentResult: ResultState,
    displayedTracks: PlaylistRow[]
  ) => {
    // Always arrayify tracks for safety
    const baseTracks = Array.isArray(displayedTracks) ? displayedTracks : [];
    const snapshot: PlaylistSnapshotV1 = {
      schema: 'playlist_snapshot',
      version: 1,
      created_at: new Date().toISOString(),
      playlist: {
        source: 'spotify',
        url: currentResult.playlistUrl || '',
        id: currentResult.playlist_id,
        name: currentResult.playlist_name,
        track_count: currentResult.total,
      },
      tracks: baseTracks.map((t) => {
        const primaryKey = t.trackKeyPrimary || t.trackKeyFallback || `${t.title}::${t.artist}`;
        const fallbackKey = t.trackKeyFallback || t.trackKeyPrimary || `${t.title}::${t.artist}`;
        return {
          title: t.title,
          artist: t.artist,
          album: (t.album ?? ''),
          isrc: t.isrc ?? null,
          owned: t.owned === true,
          owned_reason: t.ownedReason ?? null,
          track_key_primary: primaryKey,
          track_key_fallback: fallbackKey,
          track_key_version: 'v1',
          track_key_primary_type: (t.trackKeyPrimaryType as 'isrc' | 'norm') || 'norm',
          links: {
            beatport: t.stores?.beatport,
            bandcamp: t.stores?.bandcamp,
            itunes: t.stores?.itunes,
            spotify: t.spotifyUrl,
            apple: t.appleUrl,
          },
        };
      }),
    };

    const json = await matchSnapshotWithXml(JSON.stringify(snapshot), file);
    const byKey: Record<string, unknown> = {};
    const byKeyCanonical = new Map<string, unknown>();
    const tracksValue = getProp(json, "tracks");
    const tracks: unknown[] = Array.isArray(tracksValue) ? tracksValue : [];
    for (const t of tracks) {
      const key = getStringProp(t, "track_key_primary") ?? getStringProp(t, "track_key_fallback");
      if (typeof key === "string" && key) byKey[key] = t;
      const ck = canonicalizeKey(String(key ?? ""));
      if (ck && !byKeyCanonical.has(ck)) byKeyCanonical.set(ck, t);
    }
    setMultiResults((prev) => {
      const next = [...prev];
      const idx = next.findIndex((r) => r[1].playlist_id === currentResult.playlist_id);
      if (idx >= 0) {
        const nt = next[idx][1];
        // Always arrayify tracks before .map
        const safeTracks = Array.isArray(nt.tracks) ? nt.tracks : [];
        nt.tracks = safeTracks.map((t) => {
          // pick: exact -> canonical, with debug info
          const keys = [t.trackKeyPrimary, t.trackKeyFallback, t.trackKeyGuess].filter(Boolean) as string[];
          let picked: { m: any; via: "exact" | "canonical" } | null = null;
          for (const k of keys) {
            if (byKey[k]) { picked = { m: byKey[k], via: "exact" }; break; }
            const ck = canonicalizeKey(k);
            if (ck && byKeyCanonical.has(ck)) { picked = { m: byKeyCanonical.get(ck), via: "canonical" }; break; }
          }
          const m = picked?.m ?? null;
          return {
            ...t,
            owned: Boolean(m?.owned),
            ownedSource: m?.source ?? null,
            ownedReason:
              (m?.reason ?? null) +
              (picked?.via === "canonical" ? " (canonical match)" : ""),
          };
        });
        next[idx][1] = { ...nt, hasRekordboxData: true };
      }
      return next;
    });
  };

  const handleExportCSV = (tracks: PlaylistRow[], currentTitle: string) => {
    if (!tracks.length) {
      alert('No tracks to export.');
      return;
    }
    const headers = ['#', 'Title', 'Artist', 'Album', 'ISRC', 'Owned', 'Beatport', 'Bandcamp'];
    if (ENABLE_APPLE_MUSIC) headers.push('iTunes');
    const rows = tracks.map((t) => [
      t.index,
      t.title,
      t.artist,
      t.album,
      t.isrc || '',
      t.owned === true ? 'Yes' : 'No',
      t.stores.beatport,
      t.stores.bandcamp,
      ...(ENABLE_APPLE_MUSIC ? [t.stores.itunes] : []),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safePlaylistName = currentTitle.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
    a.href = url;
    a.download = `playlist_${safePlaylistName}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cancelAnalyze = () => {
    try {
      abortRef.current?.abort();
    } catch {
      // ignore
    }
    setLoading(false);
    setIsReanalyzing(false);
    setProgress(0);
    setProgressItems([]);
    setPhaseLabel(null);
  };

  const retryFailed = () => {
    const failedUrls = progressItems.filter((p) => p.status === 'error').map((p) => p.url);
    if (failedUrls.length === 0) return;
    setPlaylistUrlInput(failedUrls.join('\n'));
    handleAnalyze({ preventDefault: () => {} } as unknown as FormEvent);
  };

  return {
    // data & state
    playlistUrlInput,
    setPlaylistUrlInput,
    rekordboxFile,
    setRekordboxFile,
    rekordboxDate,
    multiResults,
    setMultiResults,
    loading,
    isReanalyzing,
    isProcessing,
    progress,
    errorText,
    setErrorText,
    errorMeta,
    forceRefreshHint,
    setForceRefreshHint,
    progressItems,
    phaseLabel,
    cancelAnalyze,
    retryFailed,
    storageWarning,
    clearLocalData,
    reAnalyzeUrl,
    setReAnalyzeUrl,
    reAnalyzeInputRef,
    // handlers
    handleAnalyze,
    handleRekordboxChange,
    handleReAnalyzeFileChange,
    handleRemoveTab,
    applySnapshotWithXml,
    handleExportCSV,
  };
}
