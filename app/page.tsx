/* eslint-disable react-hooks/refs */
'use client';

import React, {
  useEffect,
  useMemo,
} from 'react';
import type { TrackCategory } from '../lib/types';
import { usePlaylistAnalyzer } from '../lib/state/usePlaylistAnalyzer';
import { selectDisplayedTracks, selectTrackCounts, categoryLabels } from '../lib/ui/selectors';
import AnalyzeForm from './components/AnalyzeForm';
import ProgressList from './components/ProgressList';
import { ShopperHeader } from './components/ShopperHeader';
import { normalizeStores, getRecommendedStore, getOtherStores } from '../lib/playlist/stores';
import { ResultsTabs } from './components/ResultsTabs';
import { FiltersBar } from './components/FiltersBar';
import { ResultsTable } from './components/ResultsTable';
import { SidePanels } from './components/SidePanels';
import { getOwnedStatusStyle } from '../lib/ui/ownedStatus';
import { useFiltersState } from '../lib/state/useFiltersState';
import { useSelectionState } from '../lib/state/useSelectionState';
import { sanitizeForCsvCell } from '../lib/utils/csvSanitize';

// ==== Main component ====

export default function Page() {
  // Hook for Analyze state management
  const analyzer = usePlaylistAnalyzer();

  // Extract values from analyzer for use in this component
  const multiResults = analyzer.multiResults || [];
  const currentResult = analyzer.currentResult;
  const { onlyUnowned } = analyzer;

  // UI state: filters (category, search, sort)
  const filters = useFiltersState(onlyUnowned);

  // UI state: selection (tab, dropdown, form collapse)
  const selection = useSelectionState(analyzer.activeTab, analyzer.formCollapsed);

  const handleRemoveTab = (urlToRemove: string) => {
    analyzer.setMultiResults((prev) => {
      const filtered = prev.filter(([url]) => url !== urlToRemove);
      if (selection.activeTab === urlToRemove && filtered.length > 0) {
        selection.setActiveTab(filtered[0][0]);
      } else if (filtered.length === 0) {
        selection.setActiveTab(null);
      }
      return filtered;
    });
  };

  // Compute derived data via selectors (single source of truth)
  const displayedTracks = useMemo(() => {
    if (!currentResult) return [];
    return selectDisplayedTracks(currentResult.tracks, {
      categoryFilter: filters.categoryFilter,
      searchQuery: filters.searchQuery,
      sortKey: filters.sortKey,
      onlyUnowned: filters.onlyUnowned,
    });
  }, [currentResult, filters.categoryFilter, filters.searchQuery, filters.sortKey, filters.onlyUnowned]);

  const { ownedCount, toBuyCount } = useMemo(() => {
    if (!currentResult) return { ownedCount: 0, toBuyCount: 0 };
    return selectTrackCounts(currentResult.tracks);
  }, [currentResult]);

  // Snap default view when results arrive
  useEffect(() => {
    if (!currentResult) return;
    filters.setCategoryFilter('toBuy');
    selection.setFormCollapsed(true);
  }, [currentResult, filters, selection]);

  const handleExportCSV = () => {
    if (!displayedTracks.length || !currentResult) {
      alert('No tracks to export.');
      return;
    }

    const headers = ['#', 'Title', 'Artist', 'Album', 'ISRC', 'Owned', 'Beatport', 'Bandcamp', 'iTunes'];
    const rows = displayedTracks.map((t) => {
      const stores = normalizeStores(t.stores);
      return [
        sanitizeForCsvCell(t.index),
        sanitizeForCsvCell(t.title),
        sanitizeForCsvCell(t.artist),
        sanitizeForCsvCell(t.album),
        sanitizeForCsvCell(t.isrc || ''),
        sanitizeForCsvCell(t.owned === true ? 'Yes' : 'No'),
        sanitizeForCsvCell(stores.beatport),
        sanitizeForCsvCell(stores.bandcamp),
        sanitizeForCsvCell(stores.itunes),
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
          {currentResult && selection.formCollapsed ? (
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
                onClick={() => selection.setFormCollapsed(false)}
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
        {/* eslint-disable-next-line react-hooks/refs */}
        <input
          ref={analyzer.reAnalyzeInputRef}
          type="file"
          accept=".xml"
          onChange={analyzer.handleReAnalyzeFileChange}
          className="hidden"
        />

        {/* Progress bar removed; unified via ProcessingBar component above */}

        {/* Results */}
        {multiResults.length > 0 && (
          <section className="space-y-4" id="results-top">
            {/* Tabs */}
            <ResultsTabs
              multiResults={multiResults}
              activeTab={selection.activeTab}
              onSelectTab={selection.setActiveTab}
              onRemoveTab={handleRemoveTab}
              onClearAll={() => {
                analyzer.setMultiResults([]);
                selection.setActiveTab(null);
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
                    await analyzer.applySnapshotWithXml(file, result, tracks);
                    selection.setFormCollapsed(true);
                  }}
                  handleExportCSV={handleExportCSV}
                />

                <FiltersBar
                  categoryFilter={filters.categoryFilter}
                  setCategoryFilter={filters.setCategoryFilter}
                  searchQuery={filters.searchQuery}
                  setSearchQuery={filters.setSearchQuery}
                  sortKey={filters.sortKey}
                  setSortKey={filters.setSortKey}
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
                  openStoreDropdown={selection.openStoreDropdown}
                  setOpenStoreDropdown={selection.setOpenStoreDropdown}
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
