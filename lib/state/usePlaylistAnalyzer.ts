
"use client";
import type { RekordboxMeta } from "../types";
// RekordboxMeta utility
const makeRekordboxMeta = (file: File | null): RekordboxMeta | null =>
  file ? { filename: file.name, updatedAtISO: new Date(file.lastModified).toISOString() } : null;

import { useEffect, useRef, useState, ChangeEvent, FormEvent } from 'react';
import { ApiPlaylistResponse, PlaylistRow, ResultState, TrackCategory, PlaylistSnapshotV1 } from "../types";
import {
  getPlaylist,
  postPlaylistWithRekordboxUpload,
  matchSnapshotWithXml,
} from '../api/playlist';
import { detectSourceFromUrl, sanitizeUrl } from '../utils/playlistUrl';

const STORAGE_RESULTS = 'spotify-shopper-results';
const STORAGE_ACTIVE_TAB = 'spotify-shopper-active-tab';
const MAX_STORAGE_BYTES = 300 * 1024; // ~300KB guard

export function categorizeTrack(track: PlaylistRow): TrackCategory {
  if (track.owned === true) return 'owned';
  return 'checkout';
}

function mapTracks(json: ApiPlaylistResponse): PlaylistRow[] {
  return json.tracks.map((t, idx) => ({
    index: idx + 1,
    title: t.title,
    artist: t.artist,
    album: t.album,
    isrc: t.isrc ?? undefined,
    spotifyUrl: t.spotify_url ?? '',
    appleUrl: t.apple_url ?? undefined,
    stores: t.links ?? { beatport: '', bandcamp: '', itunes: '' },
    owned: t.owned ?? null,
    ownedReason: t.owned_reason ?? null,
    trackKeyPrimary: t.track_key_primary,
    trackKeyFallback: t.track_key_fallback,
    trackKeyPrimaryType: t.track_key_primary_type,
  }));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
        const ensureHydrated = async (url: string) => {
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
            const rows = mapTracks(json);
            setMultiResults((prev) =>
              prev.map(([u, r]) =>
                u === url ? [u, { ...r, tracks: rows, analyzedAt: Date.now() }] : [u, r]
              )
            );
          } catch (err) {
            setMultiResults((prev) =>
              prev.map(([u, r]) =>
                u === url ? [u, { ...r, errorText: 'トラックの取得に失敗しました', tracks: [] }] : [u, r]
              )
            );
          }
        };

      // 起動時にSTORAGE_RESULTSからmultiResultsを軽量復元（tracksは絶対に混入させない）
      useEffect(() => {
        if (typeof window === 'undefined') return;
        let idleId: any = null;
        let timeoutId: any = null;
        const run = () => {
          try {
            const saved = localStorage.getItem(STORAGE_RESULTS);
            if (!saved) return;
            if (saved.length > 512 * 1024) {
              localStorage.removeItem(STORAGE_RESULTS);
              setStorageWarning('保存データが大きすぎるため復元をスキップしました');
              return;
            }
            let parsed;
            try {
              parsed = JSON.parse(saved);
            } catch (err) {
              localStorage.removeItem(STORAGE_RESULTS);
              setStorageWarning('保存データが壊れていたため復元をスキップしました');
              return;
            }
            if (!parsed || !Array.isArray(parsed.results)) return;
            const restored: Array<[string, ResultState]> = parsed.results.map((r: any) => [
              r.url,
              {
                title: r.title ?? '',
                total: r.total ?? 0,
                playlistUrl: r.playlistUrl ?? r.url,
                playlist_id: r.playlist_id ?? undefined,
                playlist_name: r.playlist_name ?? undefined,
                tracks: undefined, // tracksは絶対に復元しない
                analyzedAt: r.analyzedAt ?? Date.now(),
                hasRekordboxData: r.hasRekordboxData ?? false,
                rekordboxMeta: r.rekordboxMeta ?? null,
                meta: r.meta ?? undefined,
              }
            ]);
            setMultiResults(restored);
          } catch (err) {
            // ignore
          }
        };
        if ('requestIdleCallback' in window) {
          idleId = (window as any).requestIdleCallback(run, { timeout: 1500 });
        } else {
          timeoutId = setTimeout(run, 0);
        }
        return () => {
          if (idleId && 'cancelIdleCallback' in window) (window as any).cancelIdleCallback(idleId);
          if (timeoutId) clearTimeout(timeoutId);
        };
      }, []);

      // 1-1: STORAGE_RESULTSへ保存時はtracksを絶対に含めない
      function saveResultsToStorage(results: Array<[string, ResultState]>) {
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
        localStorage.setItem(STORAGE_RESULTS, JSON.stringify({ results: lightResults }));
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
      localStorage.setItem(STORAGE_RESULTS, payload);
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
      localStorage.removeItem(STORAGE_RESULTS);
      localStorage.removeItem(STORAGE_ACTIVE_TAB);
      setMultiResults([]);
      setPlaylistUrlInput('');
      applyRekordboxFile(null);
      setStorageWarning(null);
    } catch (err) {
      console.error('[Storage] Failed to clear local data:', err);
      setStorageWarning('Failed to clear local data.');
    }
  };

  // activeTab is now managed by selection, not analyzer
  // currentResult is now derived in viewModel

  // (formCollapsed is now managed only by selection)

  const isProcessing = loading || isReanalyzing;

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
              appleMode: detectedSource === 'apple' ? 'auto' : undefined,
            });
            const rows = mapTracks(json);
            updatedResults.push([
              url,
              { ...result, tracks: rows, analyzedAt: Date.now(), hasRekordboxData: true, rekordboxMeta: makeRekordboxMeta(file) },
            ]);
          } catch (err) {
            console.error(`[Bulk Re-analyze] Error for ${url}:`, err);
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
        appleMode: detectedSource === 'apple' ? 'auto' : undefined,
      });
      const rows = mapTracks(json);
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
    } catch (err) {
      console.error('[Re-analyze] Error:', err);
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
    setProgress(2);
    if (progressTimer.current) {
      window.clearInterval(progressTimer.current);
    }
    progressTimer.current = window.setInterval(() => {
      setProgress((p) => Math.min(98, p + Math.random() * 12 + 3));
    }, 300) as unknown as number;

    const newResults: Array<[string, ResultState]> = [];
    let hasError = false;

    for (const url of urls) {
      let effectiveSource: 'spotify' | 'apple' = 'spotify';
      try {
        const t0 = performance.now();
        const t1_start = t0;
        effectiveSource = (detectSourceFromUrl(url) || 'spotify') as 'spotify' | 'apple';
        setPhaseLabel(effectiveSource === 'apple' ? 'Fetching Apple Music' : 'Fetching Spotify');
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

        if (effectiveSource === 'spotify') {
          const isSpotifyPlaylistUrl = /open\.spotify\.com\/.*playlist\//i.test(url);
          const isSpotifyUri = /^spotify:playlist:[A-Za-z0-9]{22}$/i.test(url);
          const isIdOnly = /^[A-Za-z0-9]{22}$/.test(url);
          if (!isSpotifyPlaylistUrl && !isSpotifyUri && !isIdOnly) {
            hasError = true;
            continue;
          }
        }

        const t2_api_start = performance.now();
        let json: ApiPlaylistResponse | null = null;
        const APPLE_TIMEOUT_MS = 45000; // 45秒に延長

        const fetchOnce = async (appleMode?: 'auto' | 'legacy' | 'fast') => {
          if (rekordboxFile) {
            return postPlaylistWithRekordboxUpload({
              url,
              source: effectiveSource,
              file: rekordboxFile,
              appleMode: appleMode ?? (effectiveSource === 'apple' ? 'auto' : undefined),
              enrichSpotify: effectiveSource === 'apple' ? false : undefined,
              refresh: isForceRefresh,
              signal: abortRef.current?.signal ?? undefined,
            });
          }
          return getPlaylist({
            url,
            source: effectiveSource,
            appleMode: appleMode ?? (effectiveSource === 'apple' ? 'auto' : undefined),
            enrichSpotify: effectiveSource === 'apple' ? false : undefined,
            refresh: isForceRefresh,
            signal: abortRef.current?.signal ?? undefined,
          });
        };

        // Apple Musicはautoモード1回のみ（backendでfast/legacy自動フォールバック）
        if (effectiveSource === 'apple') {
          setPhaseLabel('Fetching Apple Music (auto)');
          const timeoutController = new AbortController();
          const timeoutId = setTimeout(() => timeoutController.abort(), APPLE_TIMEOUT_MS);
          const externalSignal = abortRef.current?.signal;
          if (externalSignal?.aborted) timeoutController.abort();
          if (externalSignal) externalSignal.addEventListener('abort', () => timeoutController.abort());
          try {
            json = await fetchOnce('auto');
            clearTimeout(timeoutId);
          } catch (err: any) {
            clearTimeout(timeoutId);
            // UI向けエラー文言を具体化
            const reasonTag = classifyAppleError(err?.message);
            let errorMsg = '';
            switch (reasonTag) {
              case 'timeout':
                errorMsg = 'Apple Musicの取得が時間切れ。再実行する場合は時間を置いてください。';
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
                errorMsg = 'Apple Music取得に失敗しました。';
            }
            setErrorText(errorMsg);
            throw err;
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
        const rows = mapTracks(json);
        const t5_mapdone = performance.now();
        const api_ms = t3_api_done - t2_api_start;
        const map_ms = t5_mapdone - t4_mapstart;
        const total_ms = performance.now() - t1_start;
        const overhead_ms = Math.max(0, total_ms - api_ms - map_ms);
        const payload_bytes = new Blob([JSON.stringify(json)]).size;
        const metaWithTiming = {
          ...(json.meta ?? {}),
          client_total_ms: total_ms,
          client_api_ms: api_ms,
          client_map_ms: map_ms,
          client_overhead_ms: overhead_ms,
          payload_bytes,
        };
        newResults.push([
          url,
          {
            title: json.playlist_name,
            total: rows.length,
            playlistUrl: json.playlist_url,
            playlist_id: json.playlist_id,
            playlist_name: json.playlist_name,
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
      } catch (err: any) {
        hasError = true;
        // Short error message for progress list
        const errShort = typeof err?.message === 'string' ? err.message : 'request failed';
        const reasonTag = effectiveSource === 'apple'
          ? classifyAppleError(err?.data?.detail?.error || errShort)
          : null;
        setProgressItems((prev) =>
          prev.map((p) =>
            p.url === url
              ? { ...p, status: 'error', message: reasonTag ? `Apple ${reasonTag}` : errShort }
              : p
          )
        );
        if (err?.data?.detail) {
          const detail = err.data.detail;
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
            // 2-3: Apple Musicエラー詳細化
            let base = errText || 'プレイリストの取得に失敗しました';
            let reasonSuffix = usedSource === 'apple' && reasonTag ? ` (${reasonTag})` : '';
            let hint = '';
            if (usedSource === 'apple') {
              if (reasonTag === 'timeout') {
                hint = '\nApple Musicは遅い/失敗しやすい場合があります。単体URLでRetry推奨。時間をおいて再試行してください。';
              } else if (reasonTag === 'region') {
                hint = '\nApple Musicの地域制限・提供条件により取得できない場合があります。';
              } else if (reasonTag === 'bot-suspected') {
                hint = '\nApple Music側でbot判定・CAPTCHA等によりブロックされている可能性があります。時間をおいて再試行してください。';
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
    const snapshot: PlaylistSnapshotV1 = {
      schema: 'playlist_snapshot',
      version: 1,
      created_at: new Date().toISOString(),
      playlist: {
        source: currentResult.playlistUrl?.includes('music.apple.com') ? 'apple' : 'spotify',
        url: currentResult.playlistUrl || '',
        id: currentResult.playlist_id,
        name: currentResult.playlist_name,
        track_count: currentResult.total,
      },
      tracks: displayedTracks.map((t) => {
        const primaryKey = t.trackKeyPrimary || t.trackKeyFallback || `${t.title}::${t.artist}`;
        const fallbackKey = t.trackKeyFallback || t.trackKeyPrimary || `${t.title}::${t.artist}`;
        return {
          title: t.title,
          artist: t.artist,
          album: t.album,
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
    const byKey: Record<string, Record<string, unknown>> = {};
    for (const t of json.tracks || []) {
      const key = (t as any).track_key_primary || (t as any).track_key_fallback;
      if (key) byKey[key] = t as any;
    }
    setMultiResults((prev) => {
      const next = [...prev];
      const idx = next.findIndex((r) => r[1].playlist_id === currentResult.playlist_id);
      if (idx >= 0) {
        const nt = next[idx][1];
        nt.tracks = nt.tracks.map((t) => {
          const key = t.trackKeyPrimary || t.trackKeyFallback;
          const u = byKey[key || ''];
          if (u) {
            t.owned = typeof (u as any).owned === 'boolean' ? (u as any).owned : null;
            t.ownedReason = typeof (u as any).owned_reason === 'string' ? (u as any).owned_reason : null;
          }
          return t;
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
    const headers = ['#', 'Title', 'Artist', 'Album', 'ISRC', 'Owned', 'Beatport', 'Bandcamp', 'iTunes'];
    const rows = tracks.map((t) => [
      t.index,
      t.title,
      t.artist,
      t.album,
      t.isrc || '',
      t.owned === true ? 'Yes' : 'No',
      t.stores.beatport,
      t.stores.bandcamp,
      t.stores.itunes,
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
