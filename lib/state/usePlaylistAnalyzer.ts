'use client';

import { useEffect, useMemo, useRef, useState, ChangeEvent, FormEvent } from 'react';
import {
  ApiPlaylistResponse,
  PlaylistRow,
  ResultState,
  SortKey,
  TrackCategory,
  PlaylistSnapshotV1,
} from '../types';
import {
  getPlaylist,
  postPlaylistWithRekordboxUpload,
  matchSnapshotWithXml,
} from '../api/playlist';

const STORAGE_RESULTS = 'spotify-shopper-results';
const STORAGE_ACTIVE_TAB = 'spotify-shopper-active-tab';

export function categorizeTrack(track: PlaylistRow): TrackCategory {
  if (track.owned === true) return 'owned';
  return 'checkout';
}

function detectSourceFromUrl(u: string): 'spotify' | 'apple' {
  const s = (u || '').trim();
  if (!s) return 'spotify';
  const lower = s.toLowerCase();
  if (lower.includes('music.apple.com')) return 'apple';
  if (lower.includes('open.spotify.com')) return 'spotify';
  const m = s.match(/([A-Za-z0-9]{22})/);
  if (m) return 'spotify';
  return 'spotify';
}

function sanitizeUrl(raw: string): string {
  let trimmed = raw.trim();
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  trimmed = trimmed.replace(/^['"]+|['"]+$/g, '').trim();
  return trimmed;
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

export function usePlaylistAnalyzer() {
  const [playlistUrlInput, setPlaylistUrlInput] = useState('');
  const [rekordboxFile, setRekordboxFile] = useState<File | null>(null);
  const [rekordboxDate, setRekordboxDate] = useState<string | null>(null);
  const [onlyUnowned, setOnlyUnowned] = useState(false);
  const [multiResults, setMultiResults] = useState<Array<[string, ResultState]>>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [showOwned, setShowOwned] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('none');
  const [searchQuery, setSearchQuery] = useState('');
  const [formCollapsed, setFormCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [forceRefreshHint, setForceRefreshHint] = useState(false);
  const [reAnalyzeUrl, setReAnalyzeUrl] = useState<string | null>(null);
  // Progress items for per-URL status visualization
  type ProgressStatus = 'pending' | 'fetching' | 'done' | 'error';
  const [progressItems, setProgressItems] = useState<Array<{ url: string; status: ProgressStatus; message?: string }>>([]);

  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<number>(0);
  const progressTimer = useRef<number | null>(null);
  const reAnalyzeInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedResults = localStorage.getItem(STORAGE_RESULTS);
      const savedTab = localStorage.getItem(STORAGE_ACTIVE_TAB);
      if (savedResults) {
        const parsed = JSON.parse(savedResults);
        setMultiResults(parsed);
      }
      if (savedTab) {
        setActiveTab(savedTab);
      }
    } catch (err) {
      console.error('[Storage] Failed to restore results:', err);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_RESULTS, JSON.stringify(multiResults));
    } catch (err) {
      console.error('[Storage] Failed to save results:', err);
    }
  }, [multiResults]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (activeTab) {
        localStorage.setItem(STORAGE_ACTIVE_TAB, activeTab);
      } else {
        localStorage.removeItem(STORAGE_ACTIVE_TAB);
      }
    } catch (err) {
      console.error('[Storage] Failed to save active tab:', err);
    }
  }, [activeTab]);

  const currentResult = multiResults.find(([url]) => url === activeTab)?.[1] ?? null;

  useEffect(() => {
    if (!currentResult) return;
    setShowOwned(false);
    setFormCollapsed(true);
  }, [currentResult]);

  const displayedTracks = useMemo(() => {
    if (!currentResult) return [] as PlaylistRow[];
    let filtered = currentResult.tracks;
    if (onlyUnowned) {
      filtered = filtered.filter((t) => t.owned !== true);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.album.toLowerCase().includes(q)
      );
    }
    if (sortKey === 'artist') {
      filtered = [...filtered].sort((a, b) => a.artist.localeCompare(b.artist));
    } else if (sortKey === 'album') {
      filtered = [...filtered].sort((a, b) => a.album.localeCompare(b.album));
    } else if (sortKey === 'title') {
      filtered = [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    }
    if (showOwned) {
      filtered = filtered.filter((t) => categorizeTrack(t) === 'owned');
    } else {
      filtered = filtered.filter((t) => categorizeTrack(t) === 'checkout');
    }
    return filtered;
  }, [currentResult, onlyUnowned, searchQuery, sortKey, showOwned]);

  const toBuyCount = useMemo(() => {
    return currentResult
      ? currentResult.tracks.filter((t) => t.owned !== true).length
      : 0;
  }, [currentResult]);

  const ownedCount = useMemo(() => {
    return currentResult
      ? currentResult.tracks.filter((t) => t.owned === true).length
      : 0;
  }, [currentResult]);

  const isProcessing = loading || isReanalyzing;

  const handleRekordboxChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setRekordboxFile(file);
    if (file && file.lastModified) {
      const date = new Date(file.lastModified);
      setRekordboxDate(date.toLocaleString());
    } else {
      setRekordboxDate(null);
    }
  };

  const handleRemoveTab = (urlToRemove: string) => {
    setMultiResults((prev) => {
      const filtered = prev.filter(([url]) => url !== urlToRemove);
      if (activeTab === urlToRemove && filtered.length > 0) {
        setActiveTab(filtered[0][0]);
      } else if (filtered.length === 0) {
        setActiveTab(null);
      }
      return filtered;
    });
  };

  const handleReAnalyzeFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
            const rows = mapTracks(json);
            updatedResults.push([
              url,
              { ...result, tracks: rows, analyzedAt: Date.now(), hasRekordboxData: true },
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
      try {
        const t0 = performance.now();
        const effectiveSource = detectSourceFromUrl(url) || 'spotify';
        // Mark fetching start (Apple calls out longer wait explicitly)
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

        let json: ApiPlaylistResponse | null = null;
        if (rekordboxFile) {
          json = await postPlaylistWithRekordboxUpload({
            url,
            source: effectiveSource,
            file: rekordboxFile,
            enrichSpotify: effectiveSource === 'apple' ? false : undefined,
            refresh: isForceRefresh,
            signal: abortRef.current?.signal ?? undefined,
          });
        } else {
          json = await getPlaylist({
            url,
            source: effectiveSource,
            enrichSpotify: effectiveSource === 'apple' ? false : undefined,
            refresh: isForceRefresh,
            signal: abortRef.current?.signal ?? undefined,
          });
        }

        if (localRequestId !== requestIdRef.current) {
          continue;
        }

        const rows = mapTracks(json);
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
            meta: json.meta,
          },
        ]);
        // Mark success
        setProgressItems((prev) =>
          prev.map((p) => (p.url === url ? { ...p, status: 'done', message: `${rows.length} tracks` } : p))
        );

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const t3b = performance.now();
            const totalMs = t3b - t0;
            const payloadBytes = new Blob([JSON.stringify(json)]).size;
            console.log(
              `[PERF] url=${url.substring(0, 60)} tracks=${rows.length} total_ms=${totalMs.toFixed(1)} payload_bytes=${payloadBytes}`
            );
          });
        });
      } catch (err: any) {
        hasError = true;
        // Short error message for progress list
        const errShort = typeof err?.message === 'string' ? err.message : 'request failed';
        setProgressItems((prev) =>
          prev.map((p) => (p.url === url ? { ...p, status: 'error', message: errShort } : p))
        );
        if (err?.data?.detail) {
          const detail = err.data.detail;
          const usedSource = typeof detail?.used_source === 'string' ? detail.used_source : undefined;
          const errText = typeof detail?.error === 'string' ? detail.error : undefined;
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
            const msg = errText || 'プレイリストの取得に失敗しました';
            setErrorText(msg);
          }
        } else {
          setErrorText('プレイリストの取得に失敗しました');
        }
      }
    }

    if (newResults.length > 0) {
      const existingUrls = new Set(newResults.map(([url]) => url));
      const filteredExisting = multiResults.filter(([url]) => !existingUrls.has(url));
      const merged = [...newResults, ...filteredExisting];
      setMultiResults(merged);
      setActiveTab(merged[0][0]);
      setPlaylistUrlInput('');
      setRekordboxFile(null);
      setRekordboxDate(null);
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
    onlyUnowned,
    setOnlyUnowned,
    multiResults,
    setMultiResults,
    activeTab,
    setActiveTab,
    showOwned,
    setShowOwned,
    sortKey,
    setSortKey,
    searchQuery,
    setSearchQuery,
    formCollapsed,
    setFormCollapsed,
    loading,
    isReanalyzing,
    isProcessing,
    progress,
    errorText,
    setErrorText,
    forceRefreshHint,
    setForceRefreshHint,
    progressItems,
    cancelAnalyze,
    retryFailed,
    currentResult,
    displayedTracks,
    toBuyCount,
    ownedCount,
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
