'use client';

import React, {
  useState,
  useEffect,
  useMemo,
} from 'react';
import type { PlaylistSnapshotV1, TrackCategory, PlaylistRow, ResultState, StoreLinks, ApiTrack, ApiPlaylistResponse, SortKey } from '../lib/types';
import { usePlaylistAnalyzer, categorizeTrack } from '../lib/state/usePlaylistAnalyzer';
import AnalyzeForm from './components/AnalyzeForm';
import ResultSummaryBar from './components/ResultSummaryBar';
import ProgressList, { ProgressItem } from './components/ProgressList';
import { PlaylistTabs } from './components/PlaylistTabs';
import { ResultsControls } from './components/ResultsControls';
import { TrackTable } from './components/TrackTable';
import { normalizeStores, getRecommendedStore, getOtherStores } from '../lib/playlist/stores';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://127.0.0.1:8000';

// ==== Types removed - all imported from lib/types ====

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
  const { onlyUnowned } = analyzer;
  const {
    playlistUrlInput,
    setPlaylistUrlInput,
    rekordboxFile,
    setRekordboxFile,
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
    cancelAnalyze,
    retryFailed,
    formCollapsed,
    setFormCollapsed,
    sortKey,
    setSortKey,
    searchQuery,
    setSearchQuery,
    reAnalyzeUrl,
    setReAnalyzeUrl,
    reAnalyzeInputRef,
    handleAnalyze,
    handleRekordboxChange,
    handleReAnalyzeFileChange,
  } = analyzer;

  // REMOVED: Old multi-playlist state now managed by analyzer hook

  // Dropdown state: track which "Other stores" dropdown is open
  const [openStoreDropdown, setOpenStoreDropdown] = useState<string | null>(null);

  // Active category filter (UI facing). Default will snap to To buy when available.
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'toBuy' | 'owned'>('toBuy');

  // Import form collapse state handled via analyzer

  // Sort/search state handled via analyzer

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
    const rows = displayedTracks.map((t) => {
      const stores = normalizeStores(t.stores);
      return [
        t.index,
        t.title,
        t.artist,
        t.album,
        t.isrc || '',
        t.owned === true ? 'Yes' : 'No',
        stores.beatport,
        stores.bandcamp,
        stores.itunes,
      ];
    });

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
          <p className="text-base text-emerald-300 font-medium leading-relaxed">
            Paste a playlist URL → Match with Rekordbox → Open buy links
          </p>
        </header>

        {/* Form */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-4">
          {analyzer.isProcessing && (
            <div className="text-[11px] text-slate-400">
              Spotify ~10s • Apple may be slower / sometimes unsupported
            </div>
          )}
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
              errorMeta={analyzer.errorMeta}
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
                              tracks: currentResult.tracks.map((t) => ({
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
