'use client';

import React, {
  useState,
  useEffect,
  useMemo,
} from 'react';
import type { TrackCategory, SortKey } from '../lib/types';
import { usePlaylistAnalyzer, categorizeTrack } from '../lib/state/usePlaylistAnalyzer';
import AnalyzeForm from './components/AnalyzeForm';
import ProgressList from './components/ProgressList';
import { ShopperHeader } from './components/ShopperHeader';
import { normalizeStores, getRecommendedStore, getOtherStores } from '../lib/playlist/stores';
import { ResultsTabs } from './components/ResultsTabs';
import { FiltersBar } from './components/FiltersBar';
import { ResultsTable } from './components/ResultsTable';
import { SidePanels } from './components/SidePanels';

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
    reAnalyzeInputRef,
    handleAnalyze,
    handleRekordboxChange,
    handleReAnalyzeFileChange,
    applySnapshotWithXml,
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
        <ShopperHeader
          title="Playlist Shopper — Spotify & Apple Music"
          subtitle="Paste a playlist URL → Match with Rekordbox → Open buy links"
        />

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
            <ResultsTabs
              multiResults={multiResults}
              activeTab={activeTab}
              onSelectTab={setActiveTab}
              onRemoveTab={handleRemoveTab}
              onClearAll={() => {
                setMultiResults([]);
                setActiveTab(null);
              }}
            />

            {currentResult && (
              <div className="space-y-4">
                <SidePanels
                  currentResult={currentResult}
                  ownedCount={ownedCount}
                  toBuyCount={toBuyCount}
                  displayedTracks={displayedTracks}
                  applySnapshotWithXml={async (file, result, tracks) => {
                    await applySnapshotWithXml(file, result, tracks);
                    setFormCollapsed(true);
                  }}
                  handleExportCSV={handleExportCSV}
                />

                <FiltersBar
                  categoryFilter={categoryFilter}
                  setCategoryFilter={setCategoryFilter}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  sortKey={sortKey}
                  setSortKey={setSortKey}
                />

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

                <ResultsTable
                  currentResult={currentResult}
                  displayedTracks={displayedTracks}
                  categoryLabels={categoryLabels}
                  openStoreDropdown={openStoreDropdown}
                  setOpenStoreDropdown={setOpenStoreDropdown}
                  getOwnedStatusStyle={getOwnedStatusStyle}
                />
              </div>
            )}
          </section>
        )}
      </div>

      {/* Purchase modal removed per UX request */}
    </main>
  );
}
