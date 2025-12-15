'use client';

import React, {
  useState,
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
} from 'react';
import type { PlaylistSnapshotV1, TrackCategory, PlaylistRow, ResultState, StoreLinks, ApiTrack, ApiPlaylistResponse, SortKey } from '../lib/types';
import { usePlaylistAnalyzer, categorizeTrack } from '../lib/state/usePlaylistAnalyzer';
import AnalyzeForm from './components/AnalyzeForm';
import ResultSummaryBar from './components/ResultSummaryBar';
import ProgressList, { ProgressItem } from './components/ProgressList';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://127.0.0.1:8000';

// ==== Types removed - all imported from lib/types ====

// ==== Store helpers ====

function getRecommendedStore(track: PlaylistRow): { name: string; url: string } | null {
  const stores = track.stores;

  // Beatport > Bandcamp > iTunes (consistent across UI)
  if (stores.beatport && stores.beatport.length > 0) {
    return { name: 'Beatport', url: stores.beatport };
  }
  if (stores.bandcamp && stores.bandcamp.length > 0) {
    return { name: 'Bandcamp', url: stores.bandcamp };
  }
  if (stores.itunes && stores.itunes.length > 0) {
    return { name: 'iTunes', url: stores.itunes };
  }
  return null;
}

function getOtherStores(stores: StoreLinks, recommended: { name: string; url: string } | null): Array<{ name: string; url: string }> {
  const others: Array<{ name: string; url: string }> = [];
  if (stores.beatport && stores.beatport.length > 0 && recommended?.name !== 'Beatport') {
    others.push({ name: 'Beatport', url: stores.beatport });
  }
  if (stores.bandcamp && stores.bandcamp.length > 0 && recommended?.name !== 'Bandcamp') {
    others.push({ name: 'Bandcamp', url: stores.bandcamp });
  }
  if (stores.itunes && stores.itunes.length > 0 && recommended?.name !== 'iTunes') {
    others.push({ name: 'iTunes', url: stores.itunes });
  }
  return others;
}

// ==== Owned status helper ====

function getOwnedStatusStyle(
  owned: boolean | null | undefined,
  ownedReason: string | null | undefined
): { borderClass: string; tooltip: string } {
  if (owned === true) {
    const tooltip =
      ownedReason === 'isrc'
        ? '✅ Owned: Matched by ISRC'
        : ownedReason === 'exact'
        ? '✅ Owned: Matched by Title + Artist'
        : ownedReason === 'album'
        ? '✅ Owned: Matched by Title + Album'
        : ownedReason === 'fuzzy'
        ? '🟠 Maybe: Fuzzy match (low confidence)'
        : '✅ Owned';
    return {
      borderClass: 'border-l-4 border-emerald-500',
      tooltip,
    };
  }
  // All other cases (false, null, undefined) are "To Buy"
  return {
    borderClass: 'border-l-4 border-slate-600',
    tooltip: '⬛ To Buy: Not found in library',
  };
}

// ==== Main component ====

export default function Page() {
  // Hook for Analyze state management
  const analyzer = usePlaylistAnalyzer();

  // Extract values from analyzer for use in this component
  const multiResults = analyzer.multiResults || [];
  const activeTab = analyzer.activeTab;
  const setActiveTab = analyzer.setActiveTab;
  const setMultiResults = analyzer.setMultiResults;
  const currentResult = analyzer.currentResult;

  // Single/multiple playlist input
  const [playlistUrlInput, setPlaylistUrlInput] = useState('');
  const [rekordboxFile, setRekordboxFile] = useState<File | null>(null);
  const [rekordboxDate, setRekordboxDate] = useState<string | null>(null);
  const [onlyUnowned, setOnlyUnowned] = useState(false);

  // REMOVED: Old multi-playlist state now managed by analyzer hook

  // Dropdown state: track which "Other stores" dropdown is open
  const [openStoreDropdown, setOpenStoreDropdown] = useState<string | null>(null);

  // Active category filter (UI facing). Default will snap to To buy when available.
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'toBuy' | 'owned'>('toBuy');

  // Import form collapse state
  const [formCollapsed, setFormCollapsed] = useState(false);

  // Loading/error state
  const [loading, setLoading] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const requestIdRef = React.useRef<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const [errorText, setErrorText] = useState<string | null>(null);
  const isProcessing = loading || isReanalyzing;
  // Unified processing bar component (single place)
  function ProcessingBar({ analyzing, reanalyzing, progress }: { analyzing: boolean; reanalyzing: boolean; progress: number }) {
    if (!analyzing && !reanalyzing) return null;
    const label = analyzing ? 'Analyzing playlist…' : 'Matching with Rekordbox XML…';
    const pct = Math.max(progress, 5);
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-300">
          <span>{label}</span>
          <span>{Math.round(pct)}%</span>
        </div>
        <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  // Sort/search state
  const [sortKey, setSortKey] = useState<SortKey>('none');
  const [searchQuery, setSearchQuery] = useState('');

  // Re-analyze with XML state
  const [reAnalyzeUrl, setReAnalyzeUrl] = useState<string | null>(null);
  const reAnalyzeInputRef = React.useRef<HTMLInputElement | null>(null);

  const progressTimer = React.useRef<number | null>(null);

  // Restore results from localStorage on mount (client-side only)
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        // Load from localStorage
        const savedResults = localStorage.getItem('spotify-shopper-results');
        const savedTab = localStorage.getItem('spotify-shopper-active-tab');
        
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
    }
  }, []); // Run once on mount

  // Save results to localStorage whenever they change
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('spotify-shopper-results', JSON.stringify(multiResults));
      } catch (err) {
        console.error('[Storage] Failed to save results:', err);
      }
    }
  }, [multiResults]);

  // Save active tab to localStorage whenever it changes
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        if (activeTab) {
          localStorage.setItem('spotify-shopper-active-tab', activeTab);
        } else {
          localStorage.removeItem('spotify-shopper-active-tab');
        }
      } catch (err) {
        console.error('[Storage] Failed to save active tab:', err);
      }
    }
  }, [activeTab]);

  function detectSourceFromUrl(u: string): 'spotify' | 'apple' {
    const s = (u || '').trim();
    if (!s) return 'spotify';
    try {
      const lower = s.toLowerCase();
      if (lower.includes('music.apple.com')) return 'apple';
      if (lower.includes('open.spotify.com')) return 'spotify';
      const m = s.match(/([A-Za-z0-9]{22})/);
      if (m) return 'spotify';
    } catch {
      // ignore
    }
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

  const handleRekordboxChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setRekordboxFile(file);
    
    // Get file's last modified date
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
      
      // If removed tab was active, switch to first remaining tab
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

    // Check if this is a bulk re-analyze
    const isBulk = reAnalyzeUrl === '__BULK__';
    
    if (isBulk) {
      // Bulk re-analyze all playlists
      setIsReanalyzing(true);
      setLoading(false);
      setErrorText(null);
      
      try {
        const updatedResults: Array<[string, ResultState]> = [];
        
        for (const [url, result] of multiResults) {
          try {
            const detectedSource = detectSourceFromUrl(url);
            const formData = new FormData();
            formData.append('url', url);
            formData.append('source', detectedSource);
            formData.append('file', file);

            const resp = await fetch(
              `${BACKEND_URL}/api/playlist-with-rekordbox-upload`,
              {
                method: 'POST',
                body: formData,
              }
            );

            if (!resp.ok) {
              console.error(`[Bulk Re-analyze] Failed for ${url}`);
              updatedResults.push([url, result as ResultState]); // Keep original
              continue;
            }

            const json = (await resp.json()) as ApiPlaylistResponse;
            const rows: PlaylistRow[] = json.tracks.map((t, idx) => ({
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

            updatedResults.push([
              url,
              {
                ...result,
                tracks: rows,
                analyzedAt: Date.now(),
                hasRekordboxData: true,
              },
            ]);
          } catch (err) {
            console.error(`[Bulk Re-analyze] Error for ${url}:`, err);
            updatedResults.push([url, result as ResultState]); // Keep original
          }
        }

        setMultiResults(updatedResults);
        setErrorText(null);
      } catch (err) {
        console.error('[Bulk Re-analyze] Error:', err);
        setErrorText('一括XML照合中にエラーが発生しました');
      } finally {
        setIsReanalyzing(false);
        setReAnalyzeUrl(null);
        if (reAnalyzeInputRef.current) {
          reAnalyzeInputRef.current.value = '';
        }
      }
      return;
    }
    setIsReanalyzing(true);
    setLoading(false);
    setErrorText(null);

    try {
      // Find existing result
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

      const formData = new FormData();
      formData.append('url', reAnalyzeUrl);
      formData.append('source', detectedSource);
      formData.append('file', file);

      const resp = await fetch(
        `${BACKEND_URL}/api/playlist-with-rekordbox-upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!resp.ok) {
        const errText = await resp.text();
        setErrorText('XML照合に失敗しました: ' + errText);
        return;
      }

      const json = (await resp.json()) as ApiPlaylistResponse;
      const rows: PlaylistRow[] = json.tracks.map((t, idx) => ({
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

      // Update the specific result
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
      // Reset file input
      if (reAnalyzeInputRef.current) {
        reAnalyzeInputRef.current.value = '';
      }
    }
  };

  const handleAnalyze = async (e: FormEvent) => {
    e.preventDefault();
    setErrorText(null);

    // Parse multiple URLs (one per line)
    const urls = playlistUrlInput
      .split('\n')
      .map((line) => sanitizeUrl(line))
      .filter((url) => url.length > 0);

    if (urls.length === 0) {
      setErrorText('Please enter at least one playlist URL or ID.');
      return;
    }

    // Abort previous analyze if running
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

        // Validate
        if (effectiveSource === 'spotify') {
          const isSpotifyPlaylistUrl = /open\.spotify\.com\/.*playlist\//i.test(url);
          const isSpotifyUri = /^spotify:playlist:[A-Za-z0-9]{22}$/i.test(url);
          const isIdOnly = /^[A-Za-z0-9]{22}$/.test(url);
          if (!isSpotifyPlaylistUrl && !isSpotifyUri && !isIdOnly) {
            hasError = true;
            continue;
          }
        }

        // Fetch
        let res: Response;
        if (rekordboxFile) {
          const form = new FormData();
          form.append('url', url);
          form.append('source', effectiveSource);
          form.append('file', rekordboxFile);
          form.append('rekordbox_xml', rekordboxFile);

          res = await fetch(`${BACKEND_URL}/api/playlist-with-rekordbox-upload`, {
            method: 'POST',
            body: form,
            signal: abortRef.current.signal,
          });
        } else {
          const params = new URLSearchParams({ url, source: effectiveSource });
          res = await fetch(`${BACKEND_URL}/api/playlist?${params.toString()}` , { signal: abortRef.current.signal });
        }
        const t1 = performance.now();
        const networkMs = t1 - t0;

        let body: Record<string, unknown> | null = null;
        try {
          const rawText = await res.text();
          body = rawText ? JSON.parse(rawText) : null;
        } catch {
          // ignore
        }
        const t2 = performance.now();
        const jsonMs = t2 - t1;

        if (!res.ok) {
          hasError = true;
          console.log('[DEBUG] Response not OK, status:', res.status);
          // Try to surface more helpful error messages from backend
          try {
            const detail = (body && (body.detail ?? body)) || null;
            const d =
              detail && typeof detail === 'object'
                ? (detail as Record<string, unknown>)
                : null;
            const usedSource: string | undefined =
              typeof d?.used_source === 'string' ? d.used_source : undefined;
            const errText: string | undefined =
              typeof d?.error === 'string'
                ? d.error
                : typeof detail === 'string'
                  ? detail
                  : undefined;

            console.log('[DEBUG] Full error response:', { 
              body, 
              detail, 
              d, 
              usedSource, 
              errText, 
              effectiveSource,
              hasDetail: !!detail,
              detailType: typeof detail,
            });

            if (usedSource === 'spotify' || effectiveSource === 'spotify') {
              if (errText) {
                const lower = errText.toLowerCase();
                
                // Check for personalized/private FIRST (higher priority)
                const isPersonalized = lower.includes('personalized') || lower.includes('private') || lower.includes('daily mix') || lower.includes('blend');
                
                // Check for official editorial playlist (37i9 or region-restricted)
                const isOfficial = 
                  lower.includes('official editorial') ||
                  lower.includes('owner=spotify') ||
                  lower.includes('region-restricted') ||
                  lower.includes('region-locked') ||
                  lower.includes('tried markets') ||
                  lower.includes('37i9') ||
                  lower.includes('create a new public playlist');

                console.log('[DEBUG] Error classification:', {
                  isPersonalized,
                  isOfficial,
                  lower: lower.substring(0, 200),
                });

                if (isPersonalized && !isOfficial) {
                  // Purely personalized/private (no 37i9)
                  const msg = 
                    '【日本語】\n' +
                    'このSpotifyプレイリストはパーソナライズ/非公開のため、クライアントクレデンシャルでは取得できません。\n' +
                    'ワークアラウンド: 新しい自分の公開プレイリストを作成し、元のプレイリストから全曲をコピーした上で、その新しいURLを指定してください。\n\n' +
                    '【English】\n' +
                    'This Spotify playlist is personalized/private and cannot be accessed with client credentials.\n' +
                    'Workaround: Create a new public playlist in your account, copy all tracks from the original playlist, and use the new URL.';
                  console.log('[DEBUG] Setting error (personalized):', msg.substring(0, 100));
                  setErrorText(msg);
                } else if (isPersonalized && isOfficial) {
                  // Both personalized AND official (37i9) - show combined message
                  const msg = 
                    '【日本語】\n' +
                    'このSpotifyプレイリストは公式編集プレイリスト（37i9で始まるID）またはパーソナライズ/非公開のため、クライアントクレデンシャルでは取得できません。\n' +
                    'ワークアラウンド: 新しい自分の公開プレイリストを作成し、元のプレイリストから全曲をコピーした上で、その新しいURLを指定してください。\n\n' +
                    '【English】\n' +
                    'This Spotify playlist is an official editorial playlist (ID starts with 37i9) or personalized/private and cannot be accessed with client credentials.\n' +
                    'Workaround: Create a new public playlist in your account, copy all tracks from the original playlist, and use the new URL.';
                  console.log('[DEBUG] Setting error (personalized+official):', msg.substring(0, 100));
                  setErrorText(msg);
                } else if (isOfficial) {
                  // Only official editorial
                  const msg = 
                    '【日本語】\n' +
                    'このSpotifyの公式/編集プレイリスト（37i9で始まるID）は、地域制限や提供条件により取得できない場合があります。\n' +
                    'ワークアラウンド: Spotifyで新しい自分の公開プレイリストを作成し、元プレイリストの曲を全てコピー、そのURLで解析してください。\n\n' +
                    '【English】\n' +
                    'This Spotify official/editorial playlist (ID starts with 37i9) cannot be accessed due to regional restrictions or availability conditions.\n' +
                    'Workaround: Create a new public playlist in Spotify, copy all tracks from the original, and use that URL for analysis.';
                  console.log('[DEBUG] Setting error (official):', msg.substring(0, 100));
                  setErrorText(msg);
                } else {
                  const msg = 'Spotifyの取得に失敗しました / Spotify request failed: ' + errText;
                  console.log('[DEBUG] Setting error (generic spotify):', msg);
                  setErrorText(msg);
                }
              } else {
                console.log('[DEBUG] No errText found for Spotify error');
                setErrorText('Spotifyの取得に失敗しました（詳細不明）');
              }
            } else {
              // Apple or other source errors
              const msg = errText || 'プレイリストの取得に失敗しました';
              console.log('[DEBUG] Setting error (apple/other):', msg);
              setErrorText(msg);
            }
          } catch {
            // ignore parse issues
            console.log('[DEBUG] Error parsing error response, using generic message');
            setErrorText('プレイリストの取得に失敗しました');
          }
          console.log('[DEBUG] After error handling, errorText state should be set. Continuing to next URL...');
          continue;
        }

        // Guard: if a newer request started, discard this response
        if (localRequestId !== requestIdRef.current) {
          continue;
        }
        const json = body as ApiPlaylistResponse;
        const t3a = performance.now();
        const rows: PlaylistRow[] = json.tracks.map((t, idx) => ({
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
          },
        ]);

        // Schedule render metric after state updates (use requestAnimationFrame)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const t3b = performance.now();
            const renderMs = t3b - t3a;
            const totalMs = t3b - t0;
            const payloadBytes = new Blob([JSON.stringify(json)]).size;
            console.log(
              `[PERF] url=${url.substring(0, 60)} tracks=${rows.length} network_ms=${networkMs.toFixed(1)} json_ms=${jsonMs.toFixed(1)} render_ms=${renderMs.toFixed(1)} total_ms=${totalMs.toFixed(1)} payload_bytes=${payloadBytes}`
            );
          });
        });
      } catch (err) {
        console.error(err);
        hasError = true;
      }
    }

    if (newResults.length > 0) {
      // Replace existing tabs with same URL, or prepend new ones
      const existingUrls = new Set(newResults.map(([url]) => url));
      const filteredExisting = multiResults.filter(([url]) => !existingUrls.has(url));
      const merged = [...newResults, ...filteredExisting];
      setMultiResults(merged);
      // Set active tab to first (newest) result
      setActiveTab(merged[0][0]);
      
      // Clear input fields on successful analysis
      setPlaylistUrlInput('');
      setRekordboxFile(null);
      setRekordboxDate(null);
    }

    // Only show generic error if no specific error was set
    if (hasError && newResults.length === 0 && !errorText) {
      console.log('[DEBUG] Showing generic error message because no specific error was set');
      setErrorText('Failed to load playlists. Check URLs and try again.');
    } else if (hasError && newResults.length === 0 && errorText) {
      console.log('[DEBUG] hasError=true, newResults.length=0, errorText already set:', errorText.substring(0, 100));
    } else if (hasError && newResults.length > 0) {
      console.log('[DEBUG] hasError=true but got some results, newResults.length:', newResults.length);
    }

    setProgress(100);
    setTimeout(() => setProgress(0), 600);

    setLoading(false);
    if (progressTimer.current) {
      window.clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  };

  // REMOVED: currentResult/multiResults/activeTab now extracted at component top from analyzer hook

  // Filter & sort tracks
  const displayedTracks = useMemo(() => {
    if (!currentResult) return [];

    let filtered = currentResult.tracks;

    // Filter by owned status when "only unowned" is toggled
    if (onlyUnowned) {
      filtered = filtered.filter((t) => t.owned !== true);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.album.toLowerCase().includes(q)
      );
    }

    // Sort
    if (sortKey === 'artist') {
      filtered = [...filtered].sort((a, b) => a.artist.localeCompare(b.artist));
    } else if (sortKey === 'album') {
      filtered = [...filtered].sort((a, b) => a.album.localeCompare(b.album));
    } else if (sortKey === 'title') {
      filtered = [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    }

    // Category filter
    if (categoryFilter === 'owned') {
      filtered = filtered.filter((t) => categorizeTrack(t) === 'owned');
    } else if (categoryFilter === 'toBuy') {
      filtered = filtered.filter((t) => categorizeTrack(t) === 'checkout');
    }

    return filtered;
  }, [currentResult, onlyUnowned, searchQuery, sortKey, categoryFilter]);

  // Category labels for UI
  const categoryLabels: Record<'all' | TrackCategory, string> = {
    all: 'All',
    checkout: 'To buy',
    owned: 'Owned',
  };

  // Category counts
  const toBuyCount = useMemo(() => {
    return currentResult
      ? currentResult.tracks.filter(t => t.owned !== true).length
      : 0;
  }, [currentResult]);

  const ownedCount = useMemo(() => {
    return currentResult
      ? currentResult.tracks.filter(t => t.owned === true).length
      : 0;
  }, [currentResult]);

  // Snap default view when results arrive
  useEffect(() => {
    if (!currentResult) return;
    setCategoryFilter('toBuy');
    setFormCollapsed(true);
  }, [currentResult]);

  const handleExportCSV = () => {
    if (!displayedTracks.length || !currentResult) {
      alert('No tracks to export.');
      return;
    }

    const headers = ['#', 'Title', 'Artist', 'Album', 'ISRC', 'Owned', 'Beatport', 'Bandcamp', 'iTunes'];
    const rows = displayedTracks.map((t) => [
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

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Use playlist name in filename
    const safePlaylistName = currentResult.title
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 50);
    a.download = `playlist_${safePlaylistName}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">
            Playlist Shopper — Spotify & Apple Music
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Fetch playlists from Spotify or Apple Music and optionally upload your Rekordbox collection XML
            to mark tracks as Owned / Not owned. The app also generates Beatport, Bandcamp and iTunes search links.
          </p>
        </header>

        {/* Form */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-4">
          {currentResult && formCollapsed ? (
            <div className="flex items-center justify-between text-sm text-slate-200">
              <div className="flex items-center gap-2">
                {currentResult.hasRekordboxData && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/20 px-2 py-0.5 text-[11px] text-emerald-200">
                    XML attached
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setFormCollapsed(false)}
                className="px-3 py-1 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 text-emerald-200 flex items-center gap-2"
              >
                <span className="text-base leading-none">＋</span>
                <span>Add playlist</span>
              </button>
            </div>
          ) : (
            <AnalyzeForm
              playlistUrlInput={analyzer.playlistUrlInput}
              setPlaylistUrlInput={analyzer.setPlaylistUrlInput}
              handleAnalyze={analyzer.handleAnalyze}
              rekordboxFile={analyzer.rekordboxFile}
              setRekordboxFile={analyzer.setRekordboxFile}
              handleRekordboxChange={analyzer.handleRekordboxChange}
              onlyUnowned={analyzer.onlyUnowned}
              setOnlyUnowned={analyzer.setOnlyUnowned}
              loading={analyzer.loading}
              isReanalyzing={analyzer.isReanalyzing}
              progress={analyzer.progress}
              errorText={analyzer.errorText}
              progressItems={analyzer.progressItems}
              setForceRefreshHint={analyzer.setForceRefreshHint}
              cancelAnalyze={analyzer.cancelAnalyze}
              retryFailed={analyzer.retryFailed}
            />
          )}

          {/* Always-visible progress list under the form when processing */}
          {analyzer.isProcessing && (
            <div className="mt-4">
              <ProgressList items={analyzer.progressItems} isProcessing={analyzer.isProcessing} />
            </div>
          )}

          {errorText && (
            <div className="mt-4 rounded-md border border-red-500/60 bg-red-900/30 px-3 py-2 text-xs whitespace-pre-wrap">
              {errorText}
            </div>
          )}
        </section>

        {/* Hidden file input for re-analyze */}
        <input
          ref={reAnalyzeInputRef}
          type="file"
          accept=".xml"
          onChange={handleReAnalyzeFileChange}
          className="hidden"
        />

        {/* Progress bar removed; unified via ProcessingBar component above */}

        {/* Results */}
        {multiResults.length > 0 && (
          <section className="space-y-4" id="results-top">
            {/* Tabs */}
            <div className="flex items-center gap-3 pb-2 border-b border-slate-800">
              <div className="flex gap-2 overflow-x-auto flex-1">
                {multiResults.map(([url, result]) => {
                  const isActive = activeTab === url;
                  return (
                    <div
                      key={url}
                      className={`flex items-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap rounded-t-lg transition ${
                        isActive
                          ? 'bg-emerald-500/20 border-b-2 border-emerald-500 text-emerald-200'
                          : 'bg-slate-800/50 hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <button
                        onClick={() => setActiveTab(url)}
                        className="text-left min-w-0 flex items-center gap-1.5"
                      >
                        <span>{result.title} ({result.total})</span>
                        {result.hasRekordboxData && (
                          <span className="text-[10px] px-1 py-0.5 bg-emerald-600/30 text-emerald-300 rounded" title="Analyzed with Rekordbox XML">
                            XML✓
                          </span>
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveTab(url);
                        }}
                        className="text-slate-400 hover:text-red-400 transition text-lg leading-none flex-shrink-0"
                        title="Remove this playlist"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => {
                  setMultiResults([]);
                  setActiveTab(null);
                }}
                className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition whitespace-nowrap"
                title="Clear all playlists"
              >
                Clear All
              </button>
            </div>

            {currentResult && (
              <div className="space-y-4">
                {/* Summary bar above controls and table */}
                <ResultSummaryBar
                  result={currentResult}
                  ownedCount={ownedCount}
                  toBuyCount={toBuyCount}
                />
                {/* Info & controls */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="font-semibold">
                      {currentResult.title}{' '}
                      {currentResult.playlistUrl && (
                        <a
                          href={currentResult.playlistUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-emerald-300 hover:underline ml-2"
                        >
                          Open
                        </a>
                      )}
                    </h2>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:gap-2 sm:flex-wrap">
                      <label className="px-3 py-1.5 rounded bg-slate-700 border border-slate-600 text-slate-200 text-xs font-medium cursor-pointer hover:bg-slate-600">
                        Re-analyze with XML
                        <input type="file" accept=".xml" className="hidden" onChange={async (ev) => {
                          const file = ev.target.files?.[0];
                          if (!file) return;
                          try {
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
                              tracks: displayedTracks.map((t) => ({
                                title: t.title,
                                artist: t.artist,
                                album: t.album,
                                isrc: t.isrc ?? null,
                                owned: t.owned === true,
                                owned_reason: t.ownedReason ?? null,
                                track_key_primary: t.trackKeyPrimary!,
                                track_key_fallback: t.trackKeyFallback!,
                                track_key_version: 'v1',
                                track_key_primary_type: (t.trackKeyPrimaryType as 'isrc' | 'norm') || 'norm',
                                links: {
                                  beatport: t.stores?.beatport,
                                  bandcamp: t.stores?.bandcamp,
                                  itunes: t.stores?.itunes,
                                  spotify: t.spotifyUrl,
                                  apple: t.appleUrl,
                                },
                              })),
                            };
                            const form = new FormData();
                            form.append('snapshot', JSON.stringify(snapshot));
                            form.append('file', file);
                            
                            // Ensure backend URL is configured
                            if (!BACKEND_URL || BACKEND_URL === 'http://127.0.0.1:8000') {
                              throw new Error('Backend URL が設定されていません。NEXT_PUBLIC_BACKEND_URL 環境変数を確認してください。');
                            }
                            
                            const res = await fetch(`${BACKEND_URL}/api/match-snapshot-with-xml`, {
                              method: 'POST',
                              body: form,
                            });
                            const updated = await res.json();
                            if (!res.ok) throw new Error(updated?.detail || 'XML適用失敗');
                            setMultiResults((prev) => {
                              const next = [...prev];
                              const idx = next.findIndex(r => r[1].playlist_id === currentResult.playlist_id);
                              if (idx >= 0) {
                                const nt = next[idx][1];
                                const byKey: Record<string, Record<string, unknown>> = {};
                                for (const t of updated.tracks || []) {
                                  const key = t.track_key_primary || t.track_key_fallback;
                                  if (key) byKey[key] = t;
                                }
                                nt.tracks = nt.tracks.map((t: PlaylistRow) => {
                                  const key =
                                    t.trackKeyPrimary ||
                                    t.trackKeyFallback;
                                  const u = byKey[key || ''];
                                  if (u) {
                                    t.owned =
                                      typeof u.owned === 'boolean' ? u.owned : null;
                                    t.ownedReason =
                                      typeof u.owned_reason === 'string'
                                        ? u.owned_reason
                                        : null;
                                  }
                                  return t;
                                });
                                next[idx][1] = { ...nt, hasRekordboxData: true };
                              }
                              return next;
                            });
                            alert('XML適用しました');
                          } catch (e: unknown) {
                            const errorMsg = e instanceof Error ? e.message : String(e);
                            alert('XML適用失敗: ' + errorMsg);
                          } finally {
                            ev.target.value = '';
                          }
                        }} />
                      </label>
                      <button
                        onClick={handleExportCSV}
                        className="px-3 py-1.5 rounded bg-slate-700 border border-slate-600 text-slate-200 text-xs font-medium hover:bg-slate-600"
                      >
                        Export as CSV
                      </button>
                    </div>
                  </div>
                </div>

                {/* Category toggle */}
                <div className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur border border-slate-800 rounded-xl p-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCategoryFilter('all')}
                      className={`flex-1 px-3 py-1 rounded border text-xs transition ${categoryFilter === 'all' ? 'bg-slate-700 border-slate-500 text-slate-100' : 'bg-slate-800/40 border-slate-700 text-slate-300 hover:bg-slate-800'}`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setCategoryFilter('toBuy')}
                      className={`flex-1 px-3 py-1 rounded border text-xs transition ${categoryFilter === 'toBuy' ? 'bg-amber-500/30 border-amber-500 text-amber-200' : 'bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20'}`}
                    >
                      To buy
                    </button>
                    <button
                      onClick={() => setCategoryFilter('owned')}
                      className={`flex-1 px-3 py-1 rounded border text-xs transition ${categoryFilter === 'owned' ? 'bg-emerald-500/30 border-emerald-500 text-emerald-100' : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20'}`}
                    >
                      Owned
                    </button>
                  </div>
                </div>

                {/* Search & Sort Controls */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    placeholder="Search tracks (title, artist, album)…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 rounded-md border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                    className="rounded-md border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <option value="none">Sort: None</option>
                    <option value="title">Sort: Title</option>
                    <option value="artist">Sort: Artist</option>
                    <option value="album">Sort: Album</option>
                  </select>
                </div>

                {/* Mobile: card list */}
                <div className="md:hidden space-y-2">
                  {displayedTracks.map((t) => {
                    // Prioritize apple_url for Apple Music playlists, spotify_url for Spotify
                    const isApplePlaylist = currentResult.playlistUrl?.includes('music.apple.com');
                    const trackUrl = isApplePlaylist 
                      ? (t.appleUrl || t.spotifyUrl || undefined)
                      : (t.spotifyUrl || t.appleUrl || undefined);
                    return (
                      <div
                        key={`${trackUrl ?? ''}-${t.index}-${t.isrc ?? ''}`}
                        className={`rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-xs ${(() => {
                          const style = getOwnedStatusStyle(t.owned, t.ownedReason);
                          return style.borderClass;
                        })()}`}
                        title={(() => {
                          const style = getOwnedStatusStyle(t.owned, t.ownedReason);
                          return style.tooltip;
                        })()}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <a
                                href={trackUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold text-slate-100 truncate hover:underline"
                              >
                                {t.title}
                              </a>
                            </div>
                            <div className="text-slate-400 text-[11px] truncate">{t.artist}</div>
                            <div className="text-slate-500 text-[11px] truncate">{t.album}</div>
                            {t.isrc && <div className="text-slate-500 text-[10px]">ISRC: {t.isrc}</div>}
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {(() => {
                            const recommended = getRecommendedStore(t);
                            const others = getOtherStores(t.stores, recommended);
                            
                            if (!recommended) return null;
                            
                            return (
                              <>
                                <a
                                  href={recommended.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 rounded-full border border-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 transition"
                                  title={`Open on ${recommended.name} (recommended)`}
                                >
                                  <span className="text-[10px] font-medium text-emerald-300">🔗</span>
                                  <span className="text-[10px] text-emerald-300">{recommended.name}</span>
                                </a>
                                {others.map((store) => (
                                  <a
                                    key={store.name}
                                    href={store.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center rounded-full border border-slate-600 px-2 py-0.5 hover:bg-slate-700"
                                  >
                                    <span className="text-[10px]">{store.name}</span>
                                  </a>
                                ))}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop: table */}
                <div className="hidden md:block mt-4 rounded-xl border border-slate-800 bg-slate-950/40 overflow-hidden">
                  <div className="max-h-[70vh] overflow-auto">
                    <table className="w-full text-xs table-fixed">
                    <thead className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur border-b border-slate-800">
                      <tr className="text-slate-200">
                        <th className="px-3 py-2 text-left text-xs font-semibold whitespace-nowrap w-14">#</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold whitespace-nowrap w-[30%]">Title</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold whitespace-nowrap w-[20%]">Artist</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold whitespace-nowrap w-[20%]">Album</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold whitespace-nowrap w-[12%]">ISRC</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold whitespace-nowrap w-[18%]">Stores</th>
                        {/* Status column removed per UX request */}
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const sections: Array<{ id: TrackCategory; label: string; color: string; items: PlaylistRow[]; icon: string }> = [
                          { id: 'checkout', label: categoryLabels.checkout, color: 'text-amber-300', icon: '🛒', items: displayedTracks.filter((t) => categorizeTrack(t) === 'checkout') },
                          { id: 'owned', label: categoryLabels.owned, color: 'text-emerald-300', icon: '✅', items: displayedTracks.filter((t) => categorizeTrack(t) === 'owned') },
                        ];

                        return sections.flatMap((section) => {
                          if (section.items.length === 0) return [];
                          return [
                            (
                              <tr key={`section-${section.id}`} className="bg-slate-900/70">
                                <td colSpan={6} className={`px-3 py-2 text-left text-[11px] font-semibold ${section.color}`}>
                                  {section.icon} {section.label} ({section.items.length})
                                </td>
                              </tr>
                            ),
                            ...section.items.map((t) => {
                              // Prioritize apple_url for Apple Music playlists, spotify_url for Spotify
                              const isApplePlaylist = currentResult.playlistUrl?.includes('music.apple.com');
                              const trackUrl = isApplePlaylist
                                ? (t.appleUrl || t.spotifyUrl || undefined)
                                : (t.spotifyUrl || t.appleUrl || undefined);
                              return (
                                <tr
                                  key={`${section.id}-${trackUrl ?? ''}-${t.index}-${t.isrc ?? ''}`}
                                  className="border-b border-slate-900/60 hover:bg-slate-800/40 transition-colors relative"
                                >
                                  <td className="px-3 py-1 text-slate-400">
                                    {t.index}
                                  </td>
                                  <td className="px-3 py-1 text-sm text-slate-100">
                                    <a
                                      href={trackUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="block max-w-full truncate hover:underline"
                                      title={`${t.title}${(() => {
                                        const style = getOwnedStatusStyle(t.owned, t.ownedReason);
                                        return style.tooltip ? ` (${style.tooltip})` : '';
                                      })()}`}
                                    >
                                      {t.title}
                                    </a>
                                  </td>
                                  <td className="px-3 py-1 text-sm text-slate-300">
                                    <span className="block max-w-full truncate" title={t.artist}>
                                      {t.artist}
                                    </span>
                                  </td>
                                  <td className="px-3 py-1 text-xs text-slate-300">
                                    <span className="block max-w-full truncate" title={t.album}>
                                      {t.album}
                                    </span>
                                  </td>
                                  <td className="px-2 py-1 text-xs text-slate-400 truncate">
                                    {t.isrc ?? ''}
                                  </td>
                                  <td className="px-3 py-1">
                                    {(() => {
                                      const recommended = getRecommendedStore(t);
                                      const others = getOtherStores(t.stores, recommended);

                                      if (!recommended) return null;

                                      return (
                                        <div className="flex items-center gap-1">
                                          {/* Primary store button */}
                                          <a
                                            href={recommended.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 rounded-full border border-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-0.5 transition"
                                            title={`Open on ${recommended.name} (recommended)`}
                                          >
                                            <span className="text-[10px] font-medium text-emerald-300">🔗</span>
                                            <span className="text-[10px] text-emerald-300">{recommended.name}</span>
                                          </a>

                                          {/* Dropdown for other stores */}
                                          {others.length > 0 && (
                                            <div className="relative">
                                              {(() => {
                                                const dropdownId = `${section.id}-${t.index}-stores`;
                                                const isOpen = openStoreDropdown === dropdownId;
                                                return (
                                                  <>
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setOpenStoreDropdown(isOpen ? null : dropdownId);
                                                      }}
                                                      className="inline-flex items-center rounded-full border border-slate-600 px-2 py-0.5 hover:bg-slate-700 transition text-[10px] text-slate-300"
                                                      title="Other stores"
                                                    >
                                                      +{others.length}
                                                    </button>
                                                    {isOpen && (
                                                      <div className="absolute right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-lg z-50 min-w-40">
                                                        {others.map((store) => (
                                                          <a
                                                            key={store.name}
                                                            href={store.url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="block px-3 py-2 text-xs text-slate-200 hover:bg-slate-700 first:rounded-t-lg last:rounded-b-lg transition"
                                                            onClick={() => setOpenStoreDropdown(null)}
                                                          >
                                                            {store.name}
                                                          </a>
                                                        ))}
                                                      </div>
                                                    )}
                                                  </>
                                                );
                                              })()}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </td>
                                  {/* Status/actions removed per UX request */}
                                </tr>
                              );
                            }),
                          ];
                        }).filter(Boolean);
                      })()}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Purchase modal removed per UX request */}
    </main>
  );
}
