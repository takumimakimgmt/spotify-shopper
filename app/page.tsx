'use client';

import React, {
  useState,
  ChangeEvent,
  FormEvent,
  useMemo,
} from 'react';
import {
  initDB,
  getBuylist,
  saveBuylist,
  updateTrackState,
  type BuylistSnapshot,
  type TrackState,
  type PurchaseState,
  type StoreSelected,
} from '@/lib/buylistStore';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://127.0.0.1:8000';

// ==== Types ====

type StoreLinks = {
  beatport: string;
  bandcamp: string;
  itunes: string;
};

type ApiTrack = {
  title: string;
  artist: string;
  album: string;
  isrc?: string | null;
  spotify_url: string;
  apple_url?: string | null;
  links: StoreLinks;
  owned?: boolean | null;
  owned_reason?: string | null;
  track_key_primary?: string;
  track_key_fallback?: string;
  track_key_primary_type?: 'isrc' | 'norm';
  track_key_version?: string;
};

type ApiPlaylistResponse = {
  playlist_id: string;
  playlist_name: string;
  playlist_url: string;
  tracks: ApiTrack[];
};

type PlaylistRow = {
  index: number;
  title: string;
  artist: string;
  album: string;
  isrc?: string;
  spotifyUrl: string;
  appleUrl?: string;
  stores: StoreLinks;
  owned?: boolean | null;
  ownedReason?: string | null;
  // Buylist state
  trackKeyPrimary?: string;
  trackKeyFallback?: string;
  trackKeyPrimaryType?: 'isrc' | 'norm';
  purchaseState?: 'need' | 'bought' | 'skipped' | 'ambiguous';
  storeSelected?: 'beatport' | 'itunes' | 'bandcamp';
};

type ResultState = {
  title: string;
  total: number;
  playlistUrl: string;
  tracks: PlaylistRow[];
  analyzedAt: number; // timestamp when analyzed
};

type RekordboxTrack = {
  title: string;
  artist: string;
  album?: string;
  isrc?: string | null;
};

type SortKey = 'none' | 'artist' | 'album' | 'title';

// ==== Rekordbox XML parsing ====

function normalizeKey(input: string): string {
  try {
    const n = input.normalize('NFKC').toLowerCase();
    return n.replace(/\s+/g, '').replace(/[^\p{L}\p{N}]/gu, '');
  } catch (e) {
    return input
      .toLowerCase()
      .normalize('NFKC')
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9]/g, '');
  }
}

function buildTrackKey(
  title: string,
  artist: string,
  isrc?: string | null
): string {
  const base = `${normalizeKey(title)}::${normalizeKey(artist)}`;
  return isrc ? `${base}::${isrc.toUpperCase()}` : base;
}

function parseRekordboxXml(text: string): RekordboxTrack[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/xml');

  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error(
      'Failed to parse Rekordbox XML. Please provide a collection.xml file.'
    );
  }

  const tracks: RekordboxTrack[] = [];
  const nodes = Array.from(doc.getElementsByTagName('TRACK'));

  for (const node of nodes) {
    const title = node.getAttribute('Name') ?? '';
    const artist = node.getAttribute('Artist') ?? '';
    const album = node.getAttribute('Album') ?? undefined;
    const isrc = node.getAttribute('ISRC') ?? undefined;

    if (!title || !artist) continue;

    tracks.push({ title, artist, album, isrc });
  }

  return tracks;
}

// ==== Owned status helper ====

function getOwnedStatusReason(
  owned: boolean | null | undefined,
  ownedReason: string | null | undefined
): { icon: string; label: string; tooltip: string } {
  if (owned === true) {
    const reasonLabel =
      ownedReason === 'isrc'
        ? 'Matched by ISRC'
        : ownedReason === 'exact'
        ? 'Matched by Title + Artist'
        : ownedReason === 'album'
        ? 'Matched by Title + Album'
        : ownedReason === 'fuzzy'
        ? 'Matched by Fuzzy Title + Artist'
        : 'Matched';
    return {
      icon: '🟢',
      label: 'YES',
      tooltip: reasonLabel,
    };
  } else if (owned === false) {
    return {
      icon: '⚪️',
      label: 'NO',
      tooltip: 'Not found in library',
    };
  } else {
    return {
      icon: '🟡',
      label: '?',
      tooltip: 'Maybe (fuzzy match, low confidence)',
    };
  }
}

// ==== Main component ====

export default function Page() {
  // Single/multiple playlist input
  const [playlistUrlInput, setPlaylistUrlInput] = useState('');
  const [rekordboxFile, setRekordboxFile] = useState<File | null>(null);
  const [rekordboxDate, setRekordboxDate] = useState<string | null>(null);
  const [onlyUnowned, setOnlyUnowned] = useState(false);

  // Multi-playlist results: ordered array (newest first)
  const [multiResults, setMultiResults] = useState<Array<[string, ResultState]>>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  // Loading/error state
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [appleNotice, setAppleNotice] = useState(false);

  // Sort/search state
  const [sortKey, setSortKey] = useState<SortKey>('none');
  const [searchQuery, setSearchQuery] = useState('');

  // Undo state (last action only)
  const [lastAction, setLastAction] = useState<{
    playlistUrl: string;
    trackKeyPrimary: string;
    oldState: PurchaseState;
    timestamp: number;
  } | null>(null);

  const progressTimer = React.useRef<number | null>(null);

  // Restore results from localStorage on mount (client-side only)
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
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
    } catch (e) {
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

  // Buylist state management
  const handlePurchaseStateChange = async (
    playlistUrl: string,
    track: PlaylistRow,
    newState: PurchaseState
  ) => {
    if (!track.trackKeyPrimary || !currentResult) return;

    const oldState = track.purchaseState || 'need';

    try {
      await initDB();
      
      // Get current snapshot or create new one
      const playlistId = multiResults.find(([url]) => url === playlistUrl)?.[1]?.title || playlistUrl;
      let snapshot = await getBuylist(playlistId);
      
      if (!snapshot) {
        // Create new snapshot
        snapshot = {
          playlistId,
          playlistUrl,
          playlistName: currentResult.title,
          tracks: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
      }
      
      // Find or create track state
      const existingIdx = snapshot.tracks.findIndex(
        (ts) => ts.trackKeyPrimary === track.trackKeyPrimary
      );
      
      const trackState: TrackState = {
        trackKeyPrimary: track.trackKeyPrimary,
        trackKeyFallback: track.trackKeyFallback || track.trackKeyPrimary,
        trackKeyPrimaryType: track.trackKeyPrimaryType || 'norm',
        title: track.title,
        artist: track.artist,
        purchaseState: newState,
        storeSelected: track.storeSelected || 'beatport',
        updatedAt: Date.now(),
      };
      
      if (existingIdx >= 0) {
        snapshot.tracks[existingIdx] = trackState;
      } else {
        snapshot.tracks.push(trackState);
      }
      
      // Save to IndexedDB
      await saveBuylist(snapshot);
      
      // Update UI
      setMultiResults((prev) => {
        return prev.map(([url, result]) => {
          if (url === playlistUrl) {
            return [
              url,
              {
                ...result,
                tracks: result.tracks.map((t) =>
                  t.trackKeyPrimary === track.trackKeyPrimary
                    ? { ...t, purchaseState: newState }
                    : t
                ),
              },
            ];
          }
          return [url, result];
        });
      });

      // Save last action for Undo
      setLastAction({
        playlistUrl,
        trackKeyPrimary: track.trackKeyPrimary,
        oldState,
        timestamp: Date.now(),
      });

      // Clear undo after 2 seconds
      setTimeout(() => {
        setLastAction((prev) =>
          prev && prev.timestamp === trackState.updatedAt ? null : prev
        );
      }, 2000);
    } catch (err) {
      console.error('[Buylist] Failed to save state:', err);
    }
  };

  const handleUndo = async () => {
    if (!lastAction) return;

    const { playlistUrl, trackKeyPrimary, oldState } = lastAction;

    try {
      await initDB();
      
      const playlistId = multiResults.find(([url]) => url === playlistUrl)?.[1]?.title || playlistUrl;
      const snapshot = await getBuylist(playlistId);
      
      if (!snapshot) return;
      
      const existingIdx = snapshot.tracks.findIndex(
        (ts) => ts.trackKeyPrimary === trackKeyPrimary
      );
      
      if (existingIdx >= 0) {
        snapshot.tracks[existingIdx].purchaseState = oldState;
        snapshot.tracks[existingIdx].updatedAt = Date.now();
        await saveBuylist(snapshot);
        
        // Update UI
        setMultiResults((prev) => {
          return prev.map(([url, result]) => {
            if (url === playlistUrl) {
              return [
                url,
                {
                  ...result,
                  tracks: result.tracks.map((t) =>
                    t.trackKeyPrimary === trackKeyPrimary
                      ? { ...t, purchaseState: oldState }
                      : t
                  ),
                },
              ];
            }
            return [url, result];
          });
        });
      }
      
      setLastAction(null);
    } catch (err) {
      console.error('[Buylist] Failed to undo:', err);
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

    // Check if any URL is Apple Music and show notice immediately
    const hasApple = urls.some(u => detectSourceFromUrl(u) === 'apple');
    if (hasApple) {
      setAppleNotice(true);
    }

    for (const url of urls) {
      try {
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
          });
        } else {
          const params = new URLSearchParams({ url, source: effectiveSource });
          res = await fetch(`${BACKEND_URL}/api/playlist?${params.toString()}`);
        }

        let body: any = null;
        try {
          const rawText = await res.text();
          body = rawText ? JSON.parse(rawText) : null;
        } catch (e) {
          // ignore
        }

        if (!res.ok) {
          hasError = true;
          console.log('[DEBUG] Response not OK, status:', res.status);
          // Try to surface more helpful error messages from backend
          try {
            const detail = (body && (body.detail ?? body)) || null;
            const d = (detail && typeof detail === 'object') ? detail as any : null;
            const usedSource: string | undefined = d?.used_source;
            const errText: string | undefined = d?.error ?? (typeof detail === 'string' ? detail : undefined);

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
                  const msg = 'Spotifyの取得に失敗しました / Spotify fetch failed: ' + errText;
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
          } catch (_) {
            // ignore parse issues
            console.log('[DEBUG] Error parsing error response, using generic message');
            setErrorText('プレイリストの取得に失敗しました');
          }
          console.log('[DEBUG] After error handling, errorText state should be set. Continuing to next URL...');
          continue;
        }

        const json = body as ApiPlaylistResponse;
        const rows: PlaylistRow[] = json.tracks.map((t, idx) => ({
          index: idx + 1,
          title: t.title,
          artist: t.artist,
          album: t.album,
          isrc: t.isrc ?? undefined,
          spotifyUrl: t.spotify_url ?? '',
          appleUrl: (t as any).apple_url ?? undefined,
          stores: t.links ?? { beatport: '', bandcamp: '', itunes: '' },
          owned: (t as any).owned ?? undefined,
          ownedReason: (t as any).owned_reason ?? undefined,
          trackKeyPrimary: t.track_key_primary,
          trackKeyFallback: t.track_key_fallback,
          trackKeyPrimaryType: t.track_key_primary_type,
          purchaseState: undefined, // Will be merged from IndexedDB
          storeSelected: undefined, // Will be merged from IndexedDB
        }));

        // Step 1: Merge Buylist state from IndexedDB
        try {
          await initDB();
          const snapshot = await getBuylist(json.playlist_id);
          
          if (snapshot && snapshot.tracks.length > 0) {
            // Build lookup map: track_key_primary → TrackState
            const stateMap = new Map<string, TrackState>();
            for (const ts of snapshot.tracks) {
              stateMap.set(ts.trackKeyPrimary, ts);
            }
            
            // Merge state into rows
            for (const row of rows) {
              if (!row.trackKeyPrimary) continue;
              
              // Try primary key first
              let state = stateMap.get(row.trackKeyPrimary);
              
              // Fallback to fallback key (migration case)
              if (!state && row.trackKeyFallback && row.trackKeyFallback !== row.trackKeyPrimary) {
                state = stateMap.get(row.trackKeyFallback);
              }
              
              if (state) {
                row.purchaseState = state.purchaseState;
                row.storeSelected = state.storeSelected;
              } else {
                // Initialize based on track_key_primary_type
                row.purchaseState = row.trackKeyPrimaryType === 'norm' ? 'ambiguous' : 'need';
                row.storeSelected = 'beatport'; // default
              }
            }
          } else {
            // No saved state: initialize all tracks
            for (const row of rows) {
              row.purchaseState = row.trackKeyPrimaryType === 'norm' ? 'ambiguous' : 'need';
              row.storeSelected = 'beatport';
            }
          }
        } catch (err) {
          console.error('[Buylist] Failed to merge state from IndexedDB:', err);
          // Fallback: initialize all as default
          for (const row of rows) {
            row.purchaseState = row.trackKeyPrimaryType === 'norm' ? 'ambiguous' : 'need';
            row.storeSelected = 'beatport';
          }
        }

        newResults.push([
          url,
          {
            title: json.playlist_name,
            total: rows.length,
            playlistUrl: json.playlist_url,
            tracks: rows,
            analyzedAt: Date.now(),
          },
        ]);
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
    }

    // Only show generic error if no specific error was set
    if (hasError && newResults.length === 0 && !errorText) {
      console.log('[DEBUG] Showing generic error message because no specific error was set');
      setErrorText('Failed to fetch playlists. Check URLs and try again.');
    } else if (hasError && newResults.length === 0 && errorText) {
      console.log('[DEBUG] hasError=true, newResults.length=0, errorText already set:', errorText.substring(0, 100));
    } else if (hasError && newResults.length > 0) {
      console.log('[DEBUG] hasError=true but got some results, newResults.length:', newResults.length);
    }

    setProgress(100);
    setTimeout(() => setProgress(0), 600);

    setLoading(false);
    setAppleNotice(false);
    if (progressTimer.current) {
      window.clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  };

  // Current active result
  const currentResult = multiResults.find(([url]) => url === activeTab)?.[1] ?? null;

  // Filter & sort tracks
  const displayedTracks = useMemo(() => {
    if (!currentResult) return [];

    let filtered = currentResult.tracks;

    // Filter by owned status
    if (onlyUnowned) {
      filtered = filtered.filter((t) => t.owned === false);
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

    return filtered;
  }, [currentResult, onlyUnowned, searchQuery, sortKey]);

  const unownedCount = currentResult
    ? currentResult.tracks.filter((t) => t.owned === false).length
    : 0;

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
      t.owned === true ? 'Yes' : t.owned === false ? 'No' : 'Unknown',
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
        <section className="bg-slate-900/70 border border-slate-800 rounded-xl p-6 space-y-4">
          <form onSubmit={handleAnalyze} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Playlist URLs or IDs (one per line)
              </label>
              <textarea
                value={playlistUrlInput}
                onChange={(e) => setPlaylistUrlInput(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono"
                placeholder="https://open.spotify.com/playlist/...&#10;https://music.apple.com/...&#10;3KCXw0N4EJmHIg0KiKjNSM"
                rows={4}
              />
              <p className="text-xs text-slate-400">
                Full URL or playlist ID. Multiple playlists will be analyzed in parallel and results shown in tabs.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Rekordbox Collection XML (optional)
              </label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <input
                  id="rekordbox-file-input"
                  type="file"
                  accept=".xml"
                  onChange={handleRekordboxChange}
                  className="hidden"
                />
                <label
                  htmlFor="rekordbox-file-input"
                  className="inline-flex items-center rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-emerald-400 cursor-pointer"
                >
                  Choose File
                </label>
                <span className="text-xs text-slate-400">
                  Upload your Rekordbox collection XML to mark Owned / Not owned.
                </span>
              </div>
              {rekordboxFile && (
                <div className="text-xs text-emerald-300 space-y-0.5">
                  <p>Selected: {rekordboxFile.name}</p>
                  {rekordboxDate && <p>Date: {rekordboxDate}</p>}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={onlyUnowned}
                  onChange={(e) => setOnlyUnowned(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-emerald-500"
                />
                <span>Show only unowned tracks</span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-black hover:bg-emerald-400 disabled:opacity-60"
              >
                {loading ? 'Analyzing…' : 'Analyze'}
              </button>
            </div>
          </form>

          {errorText && (
            <div className="mt-4 rounded-md border border-red-500/60 bg-red-900/30 px-3 py-2 text-xs whitespace-pre-wrap">
              {errorText}
            </div>
          )}
        </section>

        {/* Apple Music notice - show immediately when analyzing */}
        {appleNotice && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-200 px-3 py-2 text-xs">
            <div>Apple Music は Spotify より解析に時間がかかります（Webレンダリング + Spotify補完のため）。</div>
            <div className="mt-1">Apple Music takes longer to analyze than Spotify (due to web rendering + Spotify enrichment).</div>
          </div>
        )}

        {/* Progress bar */}
        {loading && (
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-2 bg-emerald-500 transition-all duration-200"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
              style={{ width: `${Math.round(progress)}%` }}
            />
          </div>
        )}

        {/* Results */}
        {multiResults.length > 0 && (
          <section className="space-y-4">
            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-800">
              {multiResults.map(([url, result]) => {
                const isActive = activeTab === url;
                return (
                  <button
                    key={url}
                    onClick={() => setActiveTab(url)}
                    className={`px-4 py-2 text-sm whitespace-nowrap rounded-t-lg transition ${
                      isActive
                        ? 'bg-emerald-500/20 border-b-2 border-emerald-500 text-emerald-200'
                        : 'bg-slate-800/50 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    {result.title} ({result.total})
                  </button>
                );
              })}
            </div>

            {currentResult && (
              <div className="space-y-4">
                {/* Undo Toast */}
                {lastAction && (
                  <div className="fixed bottom-4 right-4 z-50 bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 shadow-lg flex items-center gap-3 animate-fade-in">
                    <span className="text-sm text-slate-300">
                      Action saved
                    </span>
                    <button
                      onClick={handleUndo}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition"
                    >
                      Undo
                    </button>
                  </div>
                )}

                {/* Info & controls */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-sm text-slate-400">
                      Total {currentResult.total} tracks — Displaying {displayedTracks.length} — Unowned {unownedCount}
                    </div>
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

                {/* Export Controls */}
                <div className="flex gap-2">
                  <button
                    onClick={handleExportCSV}
                    className="inline-flex items-center rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-500"
                  >
                    Export as CSV
                  </button>
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
                        className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <a
                            href={trackUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-emerald-200 hover:underline"
                          >
                            {t.title}
                          </a>
                          <div>
                            {(() => {
                              const status = getOwnedStatusReason(t.owned, t.ownedReason);
                              return (
                                <span
                                  className="inline-flex items-center justify-center text-lg cursor-help"
                                  title={status.tooltip}
                                >
                                  {status.icon}
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="mt-1 text-slate-300">{t.artist}</div>
                        <div className="mt-1 text-slate-400 text-xs">{t.album}</div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {t.stores.beatport && (
                            <a
                              href={t.stores.beatport}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center rounded-full border border-slate-600 px-2 py-0.5 hover:bg-slate-700"
                            >
                              <span className="text-[10px]">Beatport</span>
                            </a>
                          )}
                          {t.stores.bandcamp && (
                            <a
                              href={t.stores.bandcamp}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center rounded-full border border-slate-600 px-2 py-0.5 hover:bg-slate-700"
                            >
                              <span className="text-[10px]">Bandcamp</span>
                            </a>
                          )}
                          {t.stores.itunes && (
                            <a
                              href={t.stores.itunes}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center rounded-full border border-slate-600 px-2 py-0.5 hover:bg-slate-700"
                            >
                              <span className="text-[10px]">iTunes</span>
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop: table */}
                <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/70">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-900/90">
                      <tr className="border-b border-slate-800 text-slate-300">
                        <th className="px-3 py-2 text-left w-10">#</th>
                        <th className="px-3 py-2 text-left">Title</th>
                        <th className="px-3 py-2 text-left">Artist</th>
                        <th className="px-3 py-2 text-left">Album</th>
                        <th className="px-2 py-2 text-left w-24">ISRC</th>
                        <th className="px-2 py-2 text-center w-16">Own</th>
                        <th className="px-3 py-2 text-left">Stores</th>
                        <th className="px-3 py-2 text-center w-40">Buylist</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedTracks.map((t) => {
                        // Prioritize apple_url for Apple Music playlists, spotify_url for Spotify
                        const isApplePlaylist = currentResult.playlistUrl?.includes('music.apple.com');
                        const trackUrl = isApplePlaylist 
                          ? (t.appleUrl || t.spotifyUrl || undefined)
                          : (t.spotifyUrl || t.appleUrl || undefined);
                        return (
                          <tr
                            key={`${trackUrl ?? ''}-${t.index}-${t.isrc ?? ''}`}
                            className="border-b border-slate-800/70 hover:bg-slate-800/40 even:bg-slate-900/60"
                          >
                            <td className="px-3 py-1 text-slate-400">
                              {t.index}
                            </td>
                            <td className="max-w-xs px-3 py-1 text-sm font-medium text-emerald-100">
                              <a
                                href={trackUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="truncate hover:underline block"
                                title={t.title}
                              >
                                {t.title}
                              </a>
                            </td>
                            <td className="max-w-xs px-3 py-1 text-sm text-slate-300">
                              <div className="truncate" title={t.artist}>{t.artist}</div>
                            </td>
                            <td className="max-w-xs px-3 py-1 text-xs text-slate-300">
                              <div className="line-clamp-2" title={t.album}>{t.album}</div>
                            </td>
                            <td className="px-2 py-1 text-xs text-slate-400 truncate">
                              {t.isrc ?? ''}
                            </td>
                            <td className="px-2 py-1 text-center">
                              {(() => {
                                const status = getOwnedStatusReason(t.owned, t.ownedReason);
                                return (
                                  <span
                                    className="inline-flex items-center justify-center text-base cursor-help"
                                    title={status.tooltip}
                                  >
                                    {status.icon}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="px-3 py-1">
                              <div className="flex flex-wrap gap-2">
                                {t.stores.beatport && (
                                  <a
                                    href={t.stores.beatport}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center rounded-full border border-slate-600 px-2 py-0.5 hover:bg-slate-700"
                                  >
                                    <span className="text-[10px]">
                                      Beatport
                                    </span>
                                  </a>
                                )}
                                {t.stores.bandcamp && (
                                  <a
                                    href={t.stores.bandcamp}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center rounded-full border border-slate-600 px-2 py-0.5 hover:bg-slate-700"
                                  >
                                    <span className="text-[10px]">
                                      Bandcamp
                                    </span>
                                  </a>
                                )}
                                {t.stores.itunes && (
                                  <a
                                    href={t.stores.itunes}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center rounded-full border border-slate-600 px-2 py-0.5 hover:bg-slate-700"
                                  >
                                    <span className="text-[10px]">
                                      iTunes
                                    </span>
                                  </a>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-1">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    handlePurchaseStateChange(
                                      activeTab || '',
                                      t,
                                      t.purchaseState === 'bought' ? 'need' : 'bought'
                                    );
                                  }}
                                  className={`px-3 py-1 rounded text-xs font-medium transition ${
                                    t.purchaseState === 'bought'
                                      ? 'bg-green-600 text-white'
                                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                  }`}
                                  title="Mark as bought"
                                >
                                  {t.purchaseState === 'bought' ? '✓' : 'Bought'}
                                </button>
                                <button
                                  onClick={() => {
                                    handlePurchaseStateChange(
                                      activeTab || '',
                                      t,
                                      t.purchaseState === 'skipped' ? 'need' : 'skipped'
                                    );
                                  }}
                                  className={`px-3 py-1 rounded text-xs font-medium transition ${
                                    t.purchaseState === 'skipped'
                                      ? 'bg-yellow-600 text-white'
                                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                  }`}
                                  title="Skip this track"
                                >
                                  {t.purchaseState === 'skipped' ? '✓' : 'Skip'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
