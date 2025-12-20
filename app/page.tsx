"use client";

import React, { useEffect, useRef } from "react";
import { usePlaylistAnalyzer } from '../lib/state/usePlaylistAnalyzer';
import { useFiltersState } from '../lib/state/useFiltersState';
import { useSelectionState } from '../lib/state/useSelectionState';
import { useViewModel } from '../lib/state/useViewModel';
import { useActions } from '../lib/state/useActions';
import { categoryLabels } from '../lib/ui/selectors';
import { getRecommendedStore, getOtherStores } from '../lib/playlist/stores';
import AnalyzeForm from './components/AnalyzeForm';
import ProgressList from './components/ProgressList';
import { ShopperHeader } from './components/ShopperHeader';
import { ResultsTabs } from './components/ResultsTabs';
import { FiltersBar } from './components/FiltersBar';
import { ResultsTable } from './components/ResultsTable';
import { SidePanels } from './components/SidePanels';
import ErrorAlert from './components/ErrorAlert';
import { getOwnedStatusStyle } from '../lib/ui/ownedStatus';

// ==== Main component ====

export default function Page() {
  // === HOOKS: Direct calls, no composition ===
  const analyzer = usePlaylistAnalyzer();
  const filters = useFiltersState();
  const selection = useSelectionState(null, false);

  // === DERIVED DATA: Pure calculations ===
  const hasResult = Boolean(analyzer.currentResult);
  const vm = useViewModel(analyzer, filters);

  // ✅ Auto-select first tab after multiResults restoration（ここに移動）
  useEffect(() => {
    if (!selection.activeTab && vm.multiResults.length > 0) {
      selection.setActiveTab(vm.multiResults[0][0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vm.multiResults.length, selection.activeTab]);

  // === ACTIONS: All operations ===
  const actions = useActions(analyzer);

  // === SIDE EFFECTS ===
    const { setFormCollapsed } = selection;
    const prevResultRef = useRef<any>(null);
    useEffect(() => {
      const r = analyzer.currentResult;
      const hasTracks = (r?.tracks?.length ?? 0) > 0;
      if (!hasTracks) return;
      if (r !== prevResultRef.current) {
        setFormCollapsed(true);
        prevResultRef.current = r;
      }
    }, [analyzer.currentResult]);

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
              {analyzer.phaseLabel || 'Processing…'}
              {analyzer.progress < 10 && <span className="text-slate-500"> (server starting up…)</span>}
            </div>
          )}
          {analyzer.currentResult && selection.formCollapsed ? (
            <div className="flex items-center justify-between text-sm text-slate-200">
              <div className="flex items-center gap-2">
                {analyzer.currentResult.hasRekordboxData && (
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
              handleAnalyze={actions.handleAnalyze}
              rekordboxFile={analyzer.rekordboxFile}
              setRekordboxFile={analyzer.setRekordboxFile}
              handleRekordboxChange={analyzer.handleRekordboxChange}
              onlyUnowned={filters.onlyUnowned}
              setOnlyUnowned={filters.setOnlyUnowned}
              loading={analyzer.loading}
              isReanalyzing={analyzer.isReanalyzing}
              progress={analyzer.progress}
              errorText={analyzer.errorText}
              errorMeta={analyzer.errorMeta}
              progressItems={analyzer.progressItems}
              setForceRefreshHint={analyzer.setForceRefreshHint}
              cancelAnalyze={actions.cancelAnalyze}
              retryFailed={actions.retryFailed}
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
          ref={analyzer.reAnalyzeInputRef}
          type="file"
          accept=".xml"
          onChange={actions.handleReAnalyzeFileChange}
          className="hidden"
        />

        {/* Results */}
        {vm.multiResults.length > 0 && (
          <section className="space-y-4" id="results-top">
            {vm.storageWarning && (
              <ErrorAlert
                title="Local data warning"
                message={vm.storageWarning}
                hint="Use Clear saved data to reset local storage, then re-run analysis."
              />
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-400">Results are saved locally (~300KB cap). Clear to free space.</p>
              <button
                type="button"
                onClick={() => actions.clearLocalData()}
                className="self-start sm:self-auto inline-flex items-center gap-2 rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-700 border border-slate-700"
              >
                Clear saved data
              </button>
            </div>

            {/* Tabs */}
            <ResultsTabs
              multiResults={vm.multiResults}
              activeTab={selection.activeTab}
              onSelectTab={selection.setActiveTab}
              onRemoveTab={actions.handleRemoveTab}
              onClearAll={actions.handleClearAllTabs}
            />

            {vm.currentResult && (
              <div className="space-y-4">
                <SidePanels
                  currentResult={vm.currentResult}
                  ownedCount={vm.ownedCount}
                  toBuyCount={vm.toBuyCount}
                  displayedTracks={vm.displayedTracks}
                  applySnapshotWithXml={async (file, result, tracks) => {
                    await actions.applySnapshotWithXml(file, result, tracks);
                  }}
                  handleExportCSV={() => actions.downloadCsv(vm.displayedTracks, vm.currentResult)}
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
                  {vm.displayedTracks.map((t) => {
                    const isApplePlaylist = vm.currentResult?.playlistUrl?.includes('music.apple.com');
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
                  currentResult={vm.currentResult}
                  displayedTracks={vm.displayedTracks}
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
