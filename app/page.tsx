"use client";

import React, { useEffect, useRef, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

function PageInner() {
  // === HOOKS: Direct calls, no composition ===
  const analyzer = usePlaylistAnalyzer();
  const filters = useFiltersState();
  const selection = useSelectionState(null, false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // === DERIVED DATA: Pure calculations ===
  const hasResult = Boolean(analyzer.currentResult);
  const vm = useViewModel(analyzer, filters);

  const TAB_QS_KEY = "t";
  // URL(ASCII)を短く安全にクエリ化（base64url）
  const encodeTab = (url: string) =>
    btoa(url).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

  const decodeTab = (s: string) => {
    try {
      const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
      return atob(padded);
    } catch {
      return null;
    }
  };

  // (1) 初期タブ決定：URL(t) → なければ先頭
  useEffect(() => {
    if (selection.activeTab) return;
    if (vm.multiResults.length === 0) return;

    const t = searchParams.get(TAB_QS_KEY);
    const decoded = t ? decodeTab(t) : null;

    if (decoded && vm.multiResults.some(([u]) => u === decoded)) {
      selection.setActiveTab(decoded);
      return;
    }

    selection.setActiveTab(vm.multiResults[0][0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vm.multiResults.length, selection.activeTab, searchParams]);

  // (2) タブ変更をURLへ同期（リロード耐性）
  useEffect(() => {
    const tab = selection.activeTab;
    if (!tab) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set(TAB_QS_KEY, encodeTab(tab));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.activeTab, router, pathname, searchParams]);

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
          export default function Page() {
            return (
              <Suspense fallback={null}>
                <PageInner />
              </Suspense>
            );
          }

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
