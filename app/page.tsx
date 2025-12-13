'use client';

import React, {
  useState,
  ChangeEvent,
  FormEvent,
  useMemo,
} from 'react';
import type { PlaylistSnapshotV1 } from '../lib/types';
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
  playlist_id?: string; // From API response
  playlist_name?: string; // From API response
  tracks: PlaylistRow[];
  analyzedAt: number; // timestamp when analyzed
  hasRekordboxData?: boolean; // true if analyzed with Rekordbox XML
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

// ==== Track category helper ====

type TrackCategory = 'checkout' | 'hunt' | 'unknown' | 'owned';

function categorizeTrack(
  track: PlaylistRow
): TrackCategory {
  // Owned: confirmed by Rekordbox
  if (track.owned === true) {
    return 'owned';
  }
  
  // Unknown: no match found (owned === null) OR fuzzy match (low confidence)
  if (track.owned === null || track.owned === undefined) {
    return 'unknown';
  }
  // Also treat fuzzy matches (norm type) as Unknown for transparency
  if (track.ownedReason === 'fuzzy' || track.trackKeyPrimaryType === 'norm') {
    return 'unknown';
  }
  
  // owned === false: Not owned. Split into Checkout vs Hunt
  // Checkout: has STRONG store links (Beatport or iTunes only)
  // Hunt: Bandcamp-only OR no store links (manual search needed)
  
  const hasStrongStore =
    (track.stores?.beatport && track.stores.beatport.length > 0) ||
    (track.stores?.itunes && track.stores.itunes.length > 0);
  
  // If ISRC present, be more confident; if absent, be more cautious
  const hasISRC = track.isrc && track.isrc.length > 0;
  
  if (hasStrongStore) {
    // Beatport or iTunes present → always Checkout
    return 'checkout';
  }
  
  // Only Bandcamp (weak signal) → Hunt (manual search safer)
  if (track.stores?.bandcamp && track.stores.bandcamp.length > 0) {
    return 'hunt';
  }
  
  // No store links at all → Hunt
  return 'hunt';
}

// ==== Store helpers ====

function getRecommendedStore(track: PlaylistRow): { name: string; url: string } | null {
  const stores = track.stores;
  const hasISRC = track.isrc && track.isrc.length > 0;
  
  // If ISRC present, iTunes/Beatport are most reliable
  if (hasISRC) {
    if (stores.itunes && stores.itunes.length > 0) {
      return { name: 'iTunes', url: stores.itunes };
    }
    if (stores.beatport && stores.beatport.length > 0) {
      return { name: 'Beatport', url: stores.beatport };
    }
  }
  
  // If no ISRC or iTunes/Beatport not available: Beatport > Bandcamp > iTunes
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
  } else if (owned === false) {
    return {
      borderClass: 'border-l-4 border-slate-600',
      tooltip: '⬛ Not owned: Not found in library',
    };
  } else {
    return {
      borderClass: 'border-l-4 border-slate-600',
      tooltip: '? Unknown status',
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

  // Dropdown state: track which "Other stores" dropdown is open
  const [openStoreDropdown, setOpenStoreDropdown] = useState<string | null>(null);

  // Purchase modal state
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [selectedStoreTab, setSelectedStoreTab] = useState<'beatport' | 'itunes' | 'bandcamp'>('beatport');

  // Section collapse state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['checkout']));

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

  // Re-analyze with XML state
  const [reAnalyzeFile, setReAnalyzeFile] = useState<File | null>(null);
  const [reAnalyzeUrl, setReAnalyzeUrl] = useState<string | null>(null);
  const reAnalyzeInputRef = React.useRef<HTMLInputElement | null>(null);

  const progressTimer = React.useRef<number | null>(null);

  // Restore results from localStorage on mount (client-side only)
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const sp = new URLSearchParams(window.location.search);
        const shareId = sp.get('share');
        
        // If share ID is present, load ONLY the shared playlist
        if (shareId) {
          (async () => {
            try {
              const res = await fetch(`/api/share/${shareId}`);
              if (!res.ok) {
                const data = await res.json();
                console.warn('Share restore failed:', data?.error);
                return;
              }
              const data = await res.json();
              const snap = data?.snapshot;
              if (!snap || snap?.schema !== 'playlist_snapshot') {
                console.warn('Invalid snapshot schema');
                return;
              }
              const result: ResultState = {
                title: snap.playlist?.name || '(shared playlist)',
                total: snap.playlist?.track_count || (snap.tracks?.length ?? 0),
                playlistUrl: snap.playlist?.url || '',
                playlist_id: snap.playlist?.id || '',
                playlist_name: snap.playlist?.name || '(shared playlist)',
                analyzedAt: Date.now(),
                hasRekordboxData: snap.tracks?.some((t: any) => t.owned != null) || false,
                tracks: (snap.tracks || []).map((t: any, idx: number) => ({
                  index: idx + 1,
                  title: t.title,
                  artist: t.artist,
                  album: t.album || '',
                  isrc: t.isrc || undefined,
                  spotifyUrl: t.links?.spotify || '',
                  appleUrl: t.links?.apple || '',
                  owned: t.owned ?? null,
                  ownedReason: t.owned_reason ?? null,
                  trackKeyPrimary: t.track_key_primary,
                  trackKeyFallback: t.track_key_fallback,
                  trackKeyPrimaryType: t.track_key_primary_type,
                  trackKeyVersion: t.track_key_version,
                  links: {
                    beatport: t.links?.beatport || '',
                    bandcamp: t.links?.bandcamp || '',
                    itunes: t.links?.itunes || '',
                  },
                })),
              };
              const urlKey = snap.playlist?.url || `shared:${shareId}`;
              // Replace all results with ONLY the shared playlist
              setMultiResults([[urlKey, result]]);
              setActiveTab(urlKey);
            } catch (err) {
              console.error('[Share] Failed to fetch shared playlist:', err);
            }
          })();
          return; // Don't load localStorage if share ID is present
        }
        
        // Otherwise, load from localStorage
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

  const handleReAnalyzeWithXml = (url: string) => {
    setReAnalyzeUrl(url);
    // Trigger file input
    reAnalyzeInputRef.current?.click();
  };

  const handleReAnalyzeFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if this is a bulk re-analyze
    const isBulk = reAnalyzeUrl === '__BULK__';
    
    if (isBulk) {
      // Bulk re-analyze all playlists
      setLoading(true);
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
              updatedResults.push([url, result]); // Keep original
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
              appleUrl: (t as any).apple_url ?? undefined,
              stores: t.links ?? { beatport: '', bandcamp: '', itunes: '' },
              owned: (t as any).owned ?? undefined,
              ownedReason: (t as any).owned_reason ?? undefined,
              trackKeyPrimary: t.track_key_primary,
              trackKeyFallback: t.track_key_fallback,
              trackKeyPrimaryType: t.track_key_primary_type,
              purchaseState: undefined,
              storeSelected: undefined,
            }));

            // Merge Buylist state
            try {
              await initDB();
              const snapshot = await getBuylist(json.playlist_id);

              if (snapshot && snapshot.tracks.length > 0) {
                const stateMap = new Map<string, TrackState>();
                for (const ts of snapshot.tracks) {
                  stateMap.set(ts.trackKeyPrimary, ts);
                }

                for (const row of rows) {
                  if (!row.trackKeyPrimary) continue;
                  let state = stateMap.get(row.trackKeyPrimary);
                  if (!state && row.trackKeyFallback && row.trackKeyFallback !== row.trackKeyPrimary) {
                    state = stateMap.get(row.trackKeyFallback);
                  }
                  if (state) {
                    row.purchaseState = state.purchaseState;
                    row.storeSelected = state.storeSelected;
                  } else {
                    row.purchaseState = row.trackKeyPrimaryType === 'norm' ? 'ambiguous' : 'need';
                    row.storeSelected = 'beatport';
                  }
                }
              } else {
                for (const row of rows) {
                  row.purchaseState = row.trackKeyPrimaryType === 'norm' ? 'ambiguous' : 'need';
                  row.storeSelected = 'beatport';
                }
              }
            } catch (err) {
              console.error('[Buylist] Failed to merge state:', err);
              for (const row of rows) {
                row.purchaseState = row.trackKeyPrimaryType === 'norm' ? 'ambiguous' : 'need';
                row.storeSelected = 'beatport';
              }
            }

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
            updatedResults.push([url, result]); // Keep original
          }
        }

        setMultiResults(updatedResults);
        setErrorText(null);
      } catch (err) {
        console.error('[Bulk Re-analyze] Error:', err);
        setErrorText('一括XML照合中にエラーが発生しました');
      } finally {
        setLoading(false);
        setReAnalyzeFile(null);
        setReAnalyzeUrl(null);
        if (reAnalyzeInputRef.current) {
          reAnalyzeInputRef.current.value = '';
        }
      }
      return;
    }
    setReAnalyzeFile(file);
    setLoading(true);
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
        appleUrl: (t as any).apple_url ?? undefined,
        stores: t.links ?? { beatport: '', bandcamp: '', itunes: '' },
        owned: (t as any).owned ?? undefined,
        ownedReason: (t as any).owned_reason ?? undefined,
        trackKeyPrimary: t.track_key_primary,
        trackKeyFallback: t.track_key_fallback,
        trackKeyPrimaryType: t.track_key_primary_type,
        purchaseState: undefined,
        storeSelected: undefined,
      }));

      // Merge Buylist state from IndexedDB
      try {
        await initDB();
        const snapshot = await getBuylist(json.playlist_id);

        if (snapshot && snapshot.tracks.length > 0) {
          const stateMap = new Map<string, TrackState>();
          for (const ts of snapshot.tracks) {
            stateMap.set(ts.trackKeyPrimary, ts);
          }

          for (const row of rows) {
            if (!row.trackKeyPrimary) continue;

            let state = stateMap.get(row.trackKeyPrimary);
            if (!state && row.trackKeyFallback && row.trackKeyFallback !== row.trackKeyPrimary) {
              state = stateMap.get(row.trackKeyFallback);
            }

            if (state) {
              row.purchaseState = state.purchaseState;
              row.storeSelected = state.storeSelected;
            } else {
              row.purchaseState = row.trackKeyPrimaryType === 'norm' ? 'ambiguous' : 'need';
              row.storeSelected = 'beatport';
            }
          }
        } else {
          for (const row of rows) {
            row.purchaseState = row.trackKeyPrimaryType === 'norm' ? 'ambiguous' : 'need';
            row.storeSelected = 'beatport';
          }
        }
      } catch (err) {
        console.error('[Buylist] Failed to merge state:', err);
        for (const row of rows) {
          row.purchaseState = row.trackKeyPrimaryType === 'norm' ? 'ambiguous' : 'need';
          row.storeSelected = 'beatport';
        }
      }

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
      setLoading(false);
      setReAnalyzeFile(null);
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
            playlist_id: json.playlist_id,
            playlist_name: json.playlist_name,
            tracks: rows,
            analyzedAt: Date.now(),
            hasRekordboxData: !!rekordboxFile,
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
      
      // Clear input fields on successful analysis
      setPlaylistUrlInput('');
      setRekordboxFile(null);
      setRekordboxDate(null);
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

  // Category counts
  const checkoutCount = useMemo(() => {
    return currentResult
      ? currentResult.tracks.filter(t => categorizeTrack(t) === 'checkout').length
      : 0;
  }, [currentResult]);

  const huntCount = useMemo(() => {
    return currentResult
      ? currentResult.tracks.filter(t => categorizeTrack(t) === 'hunt').length
      : 0;
  }, [currentResult]);

  const unknownCount = useMemo(() => {
    return currentResult
      ? currentResult.tracks.filter(t => categorizeTrack(t) === 'unknown').length
      : 0;
  }, [currentResult]);

  const ownedCount = useMemo(() => {
    return currentResult
      ? currentResult.tracks.filter(t => t.owned === true).length
      : 0;
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
                Playlist URLs
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

        {/* Hidden file input for re-analyze */}
        <input
          ref={reAnalyzeInputRef}
          type="file"
          accept=".xml"
          onChange={handleReAnalyzeFileChange}
          className="hidden"
        />

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

        {/* Hidden file input for re-analyze */}
        <input
          ref={reAnalyzeInputRef}
          type="file"
          accept=".xml"
          onChange={handleReAnalyzeFileChange}
          className="hidden"
        />

        {/* Results */}
        {multiResults.length > 0 && (
          <section className="space-y-4">
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
                    <div className="text-xs text-slate-400 space-y-0.5">
                      <div>Tracks: {currentResult.total}</div>
                      <div>Owned: {currentResult.total - unownedCount}</div>
                      <div>Unowned: {unownedCount}</div>
                    </div>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:gap-2 sm:flex-wrap">
                      <button
                        onClick={async () => {
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
                                owned: t.owned ?? undefined,
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
                            const res = await fetch('/api/share', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ snapshot }),
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data?.error || 'Share failed');
                            const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/?share=${data.share_id}`;
                            
                            // Try clipboard API, fallback to alert with URL
                            try {
                              await navigator.clipboard.writeText(shareUrl);
                              alert('Shareリンクをコピーしました');
                            } catch (clipboardErr) {
                              // Fallback: show URL in alert for manual copy
                              alert('Shareリンク:\n' + shareUrl);
                            }
                          } catch (e: any) {
                            alert('Share失敗: ' + (e?.message ?? e));
                          }
                        }}
                        className="px-3 py-1.5 rounded bg-slate-700 border border-slate-600 text-slate-200 text-xs font-medium hover:bg-slate-600"
                      >
                        Share
                      </button>
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
                                owned: t.owned ?? undefined,
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
                                const byKey: Record<string, any> = {};
                                for (const t of updated.tracks || []) {
                                  const key = t.track_key_primary || t.track_key_fallback;
                                  if (key) byKey[key] = t;
                                }
                                nt.tracks = nt.tracks.map((t: any) => {
                                  const key = t.trackKeyPrimary || t.track_key_primary || t.track_key_fallback || t.trackKeyFallback;
                                  const u = byKey[key];
                                  if (u) {
                                    t.owned = u.owned;
                                    t.ownedReason = u.owned_reason;
                                  }
                                  return t;
                                });
                                next[idx][1] = { ...nt, hasRekordboxData: true };
                              }
                              return next as any;
                            });
                            alert('XML適用しました');
                          } catch (e: any) {
                            alert('XML適用失敗: ' + (e?.message ?? e));
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

                {/* CheckoutHeader: Stepper + Summary + Primary CTA */}
                <div className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur border border-slate-800 rounded-xl p-4 space-y-4">
                  {/* Stepper */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      {/* Step 1: Import */}
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/30 border border-emerald-500 flex items-center justify-center text-xs font-semibold text-emerald-300">
                          ✓
                        </div>
                        <div className="text-xs text-slate-400 mt-1">Import</div>
                      </div>
                      <div className="flex-1 h-0.5 bg-slate-800" />
                      
                      {/* Step 2: Match */}
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/30 border border-emerald-500 flex items-center justify-center text-xs font-semibold text-emerald-300">
                          ✓
                        </div>
                        <div className="text-xs text-slate-400 mt-1">Match</div>
                      </div>
                      <div className="flex-1 h-0.5 bg-slate-800" />
                      
                      {/* Step 3: Buy (Active) */}
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-amber-500 border border-amber-500 flex items-center justify-center text-xs font-semibold text-slate-900 font-bold">
                          3
                        </div>
                        <div className="text-xs text-amber-300 mt-1">Buy</div>
                      </div>
                    </div>
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                    <div className="bg-slate-800/50 rounded px-2 py-1.5 text-center">
                      <div className="font-semibold text-slate-100">{currentResult.total}</div>
                      <div className="text-slate-400">Total</div>
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded px-2 py-1.5 text-center">
                      <div className="font-semibold text-emerald-300">{ownedCount}</div>
                      <div className="text-emerald-600">Owned</div>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1.5 text-center">
                      <div className="font-semibold text-amber-300">{checkoutCount}</div>
                      <div className="text-amber-600">Checkout</div>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded px-2 py-1.5 text-center">
                      <div className="font-semibold text-blue-300">{huntCount}</div>
                      <div className="text-blue-600">Hunt</div>
                    </div>
                    <div className="bg-slate-500/10 border border-slate-500/30 rounded px-2 py-1.5 text-center">
                      <div className="font-semibold text-slate-300">{unknownCount}</div>
                      <div className="text-slate-500">Unknown</div>
                    </div>
                  </div>

                  {/* Primary CTA */}
                  {checkoutCount > 0 && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setPurchaseModalOpen(true);
                          setSelectedStoreTab('beatport');
                        }}
                        className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-900 font-bold text-sm transition shadow-lg"
                      >
                        🛒 Buy {checkoutCount} Tracks
                      </button>
                    </div>
                  )}

                  {/* Quick section links */}
                  <div className="flex gap-1 flex-wrap text-[10px]">
                    <a href="#section-checkout" className="px-2 py-1 rounded bg-amber-500/20 border border-amber-500/50 text-amber-300 hover:bg-amber-500/30 transition">
                      Checkout ({checkoutCount})
                    </a>
                    <a href="#section-hunt" className="px-2 py-1 rounded bg-blue-500/20 border border-blue-500/50 text-blue-300 hover:bg-blue-500/30 transition">
                      Hunt ({huntCount})
                    </a>
                    <a href="#section-unknown" className="px-2 py-1 rounded bg-slate-500/20 border border-slate-500/50 text-slate-300 hover:bg-slate-500/30 transition">
                      Unknown ({unknownCount})
                    </a>
                    <a href="#section-owned" className="px-2 py-1 rounded bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30 transition">
                      Owned ({ownedCount})
                    </a>
                  </div>

                  {/* Post-attach XML entry point */}
                  <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
                    <button
                      onClick={() => reAnalyzeInputRef.current?.click()}
                      className="px-3 py-1 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 transition"
                    >
                      Match with Rekordbox XML
                    </button>
                    <span className="text-slate-500">No URL re-entry needed</span>
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
                <div className="md:hidden space-y-2" id="section-checkout">
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
                        <div className="flex items-center justify-between gap-2">
                          <a
                            href={trackUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-emerald-200 hover:underline"
                          >
                            {t.title}
                          </a>
                        </div>
                        <div className="mt-1 text-slate-300">{t.artist}</div>
                        <div className="mt-1 text-slate-400 text-xs">{t.album}</div>
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
                <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/70 relative z-10" id="section-checkout">
                  <table className="w-full text-xs table-fixed">
                    <thead className="bg-slate-900/90">
                      <tr className="border-b border-slate-800 text-slate-300">
                        <th className="px-3 py-2 text-left w-10">#</th>
                        <th className="px-3 py-2 text-left w-1/4">Title</th>
                        <th className="px-3 py-2 text-left w-1/6">Artist</th>
                        <th className="px-3 py-2 text-left w-1/6">Album</th>
                        <th className="px-2 py-2 text-left w-24">ISRC</th>
                        <th className="px-3 py-2 text-left w-32">Stores</th>
                        <th className="px-3 py-2 text-center w-32">
                          <div className="inline-flex flex-col items-center gap-1 justify-center">
                            <div className="inline-flex items-center gap-2">
                              <span>Status</span>
                              <div className="group relative">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-slate-400 cursor-help">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8.94 6.94a.75.75 0 11-1.061-1.061 3 3 0 112.871 5.026v.345a.75.75 0 01-1.5 0v-.5c0-.72.57-1.172 1.081-1.287A1.5 1.5 0 108.94 6.94zM10 15a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                </svg>
                                <div className="absolute z-50 hidden group-hover:block bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 whitespace-nowrap -left-20 -bottom-12">
                                  Device-saved progress. Used in CSV export.
                                </div>
                              </div>
                            </div>
                            <span className="text-[9px] text-slate-500 font-normal italic">Saved on device</span>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const sections: Array<{ id: TrackCategory; label: string; color: string; items: PlaylistRow[]; icon: string }> = [
                          { id: 'checkout', label: 'Checkout', color: 'text-amber-300', icon: '🛒', items: displayedTracks.filter((t) => categorizeTrack(t) === 'checkout') },
                          { id: 'hunt', label: 'Hunt', color: 'text-blue-300', icon: '🔍', items: displayedTracks.filter((t) => categorizeTrack(t) === 'hunt') },
                          { id: 'unknown', label: 'Unknown', color: 'text-slate-300', icon: '❔', items: displayedTracks.filter((t) => categorizeTrack(t) === 'unknown') },
                          { id: 'owned', label: 'Owned', color: 'text-emerald-300', icon: '✅', items: displayedTracks.filter((t) => categorizeTrack(t) === 'owned') },
                        ];

                        return sections.flatMap((section) => {
                          if (section.items.length === 0) return [];
                          return [
                            (
                              <tr key={`section-${section.id}`} id={`section-${section.id}`} className="bg-slate-900/70">
                                <td colSpan={7} className={`px-3 py-2 text-left text-[11px] font-semibold ${section.color}`}>
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
                                  className="border-b border-slate-800/70 hover:bg-slate-800/40 even:bg-slate-900/60 relative"
                                >
                                  <td className="px-3 py-1 text-slate-400">
                                    {t.index}
                                  </td>
                                  <td
                                    className={`px-3 py-1 text-sm font-medium text-emerald-100 ${(() => {
                                      const style = getOwnedStatusStyle(t.owned, t.ownedReason);
                                      return style.borderClass;
                                    })()}`}
                                    title={(() => {
                                      const style = getOwnedStatusStyle(t.owned, t.ownedReason);
                                      return style.tooltip;
                                    })()}
                                  >
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
                                  <td className="px-3 py-1 text-sm text-slate-300">
                                    <div className="truncate" title={t.artist}>{t.artist}</div>
                                  </td>
                                  <td className="px-3 py-1 text-xs text-slate-300">
                                    <div className="line-clamp-2" title={t.album}>{t.album}</div>
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
                                  <td className="px-3 py-1 relative z-20">
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
                                        title="Mark as bought to track progress"
                                      >
                                        {t.purchaseState === 'bought' ? '✓' : 'Mark Bought'}
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
                            }),
                          ];
                        }).filter(Boolean);
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Purchase Modal */}
      {purchaseModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setPurchaseModalOpen(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-emerald-200">🛒 Buy {checkoutCount} Checkout Tracks</h2>
              <button
                onClick={() => setPurchaseModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Store Tabs */}
            <div className="flex gap-2 mb-4 border-b border-slate-800 pb-3">
              {['beatport', 'itunes', 'bandcamp'].map((store) => {
                const storeLabel = store.charAt(0).toUpperCase() + store.slice(1);
                const tracksInStore = currentResult?.tracks.filter((t) => {
                  if (categorizeTrack(t) !== 'checkout') return false;
                  if (store === 'beatport') return t.stores?.beatport?.length > 0;
                  if (store === 'itunes') return t.stores?.itunes?.length > 0;
                  if (store === 'bandcamp') return t.stores?.bandcamp?.length > 0;
                  return false;
                }).length ?? 0;

                return (
                  <button
                    key={store}
                    onClick={() => setSelectedStoreTab(store as 'beatport' | 'itunes' | 'bandcamp')}
                    disabled={tracksInStore === 0}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      selectedStoreTab === store
                        ? 'bg-emerald-500 text-slate-900'
                        : tracksInStore === 0
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {storeLabel} ({tracksInStore})
                  </button>
                );
              })}
            </div>

            {/* "Open all in store" button */}
            {(() => {
              const storeKey = selectedStoreTab as keyof StoreLinks;
              const tracksInStore = currentResult?.tracks.filter((t) => {
                if (categorizeTrack(t) !== 'checkout') return false;
                const storeUrl = storeKey === 'beatport' ? t.stores?.beatport : 
                                 storeKey === 'itunes' ? t.stores?.itunes :
                                 t.stores?.bandcamp;
                return storeUrl && storeUrl.length > 0;
              }) ?? [];

              const storeUrls = Array.from(
                new Set(
                  tracksInStore
                    .map((t) => {
                      const storeUrl = storeKey === 'beatport' ? t.stores?.beatport : 
                                       storeKey === 'itunes' ? t.stores?.itunes :
                                       t.stores?.bandcamp;
                      return storeUrl;
                    })
                    .filter(Boolean)
                )
              );

              return (
                <div className="mb-4 p-3 bg-slate-800/50 rounded-lg space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        // Open only first link to avoid popup blocking
                        if (storeUrls.length > 0) {
                          window.open(storeUrls[0], '_blank');
                        }
                      }}
                      disabled={tracksInStore.length === 0}
                      className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-bold rounded-lg transition"
                    >
                      Open in {selectedStoreTab}
                    </button>
                    <button
                      onClick={() => {
                        const linksText = storeUrls.join('\n');
                        navigator.clipboard.writeText(linksText).then(() => {
                          alert(`Copied ${storeUrls.length} link${storeUrls.length > 1 ? 's' : ''} to clipboard`);
                        }).catch(() => {
                          alert('Failed to copy. Please try again.');
                        });
                      }}
                      disabled={tracksInStore.length === 0}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 font-semibold rounded-lg transition text-sm"
                    >
                      Copy links
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">
                    {tracksInStore.length === 0
                      ? 'No tracks available in this store'
                      : `${tracksInStore.length} track${tracksInStore.length > 1 ? 's' : ''} available. Click "Open" for first, "Copy links" for all.`}
                  </p>
                </div>
              );
            })()}

            {/* Track list for this store */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {(() => {
                const storeKey = selectedStoreTab as keyof StoreLinks;
                const tracksInStore = currentResult?.tracks.filter((t) => {
                  if (categorizeTrack(t) !== 'checkout') return false;
                  const storeUrl = storeKey === 'beatport' ? t.stores?.beatport : 
                                   storeKey === 'itunes' ? t.stores?.itunes :
                                   t.stores?.bandcamp;
                  return storeUrl && storeUrl.length > 0;
                }) ?? [];

                return tracksInStore.map((t) => {
                  const storeUrl = storeKey === 'beatport' ? t.stores?.beatport : 
                                   storeKey === 'itunes' ? t.stores?.itunes :
                                   t.stores?.bandcamp;
                  return (
                    <div
                      key={`${t.index}-${selectedStoreTab}`}
                      className="flex items-center justify-between gap-3 p-2 bg-slate-800/30 rounded text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-100 truncate">{t.title}</div>
                        <div className="text-slate-400 truncate">{t.artist}</div>
                      </div>
                      {storeUrl && (
                        <a
                          href={storeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-semibold whitespace-nowrap transition"
                        >
                          Open
                        </a>
                      )}
                    </div>
                  );
                });
              })()}
            </div>

            {/* Maybe (Bandcamp-only) section - shown in modal only */}
            {(() => {
              const bandcampOnlyTracks = currentResult?.tracks.filter((t) => {
                if (categorizeTrack(t) !== 'hunt') return false;
                // Show only Bandcamp-only tracks
                return (t.stores?.bandcamp && t.stores.bandcamp.length > 0) && 
                       (!t.stores?.beatport || t.stores.beatport.length === 0) &&
                       (!t.stores?.itunes || t.stores.itunes.length === 0);
              }) ?? [];

              if (bandcampOnlyTracks.length === 0) return null;

              return (
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <div className="text-sm font-semibold text-blue-300 mb-2">
                    💙 Maybe: {bandcampOnlyTracks.length} on Bandcamp
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {bandcampOnlyTracks.map((t) => (
                      <div key={`${t.index}-maybe`} className="flex items-center justify-between gap-2 p-2 bg-slate-800/30 rounded text-xs">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-100 truncate">{t.title}</div>
                          <div className="text-slate-400 truncate text-[10px]">{t.artist}</div>
                        </div>
                        {t.stores?.bandcamp && (
                          <a
                            href={t.stores.bandcamp}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-semibold whitespace-nowrap transition"
                          >
                            Try
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-blue-400 mt-2">
                    These tracks are Bandcamp-only (less reliable). Try if store above doesn't have it.
                  </p>
                </div>
              );
            })()}

            {/* Footer */}
            <div className="mt-4 pt-4 border-t border-slate-700 text-xs text-slate-400">
              <p>💡 Use Status column to mark tracks as "Bought" once purchased</p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
