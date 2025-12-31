/**
HOTFIX SPEC (Playlist Shopper)
- Separate concerns:
  - uiTab: "all" | "toBuy" | "owned" (table filter tab)
  - activeTab: string | null (selected analyzed playlist key)
  - persistedResults: MultiResult[] (saved analyses)
- Hydrate rules:
  1) Load persistedResults on mount
  2) If activeTab is null OR not found in persistedResults, set activeTab = first key or null
  3) If persistedResults empty, show empty state (no table)
- Never persist uiTab. Persist only:
  - activeTab
  - persistedResults (capped)
- Error routing:
  - xmlError is shown ONLY under XML input
  - playlistUrlError is shown ONLY under playlist input
- XML size:
  - MAX_XML_BYTES = 50 * 1024 * 1024
  - If exceeded, set xmlError and DO NOT set playlistUrlError
TODO:
- Implement guard + fallback for activeTab
- Implement XML max size and correct error message
*/

"use client";
import { FLAGS } from "@/lib/config/flags";
import React, { useEffect, useRef, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePlaylistAnalyzer } from '../lib/state/usePlaylistAnalyzer';
import { useFiltersState } from '../lib/state/useFiltersState';
import { useSelectionState } from '../lib/state/useSelectionState';
import { useViewModel } from '../lib/state/useViewModel';
import { useActions } from '../lib/state/useActions';
import { categoryLabels } from '../lib/ui/selectors';
import { getOtherStores as _getOtherStores } from '../lib/playlist/stores';
import AnalyzeForm from './components/AnalyzeForm';
import _ProgressList from './components/ProgressList';
import { ShopperHeader as _ShopperHeader } from './components/ShopperHeader';
import { ResultsTabs } from './components/ResultsTabs';
import { FiltersBar } from './components/FiltersBar';
import dynamic from 'next/dynamic';
import SkeletonResults from './components/SkeletonResults';
const ResultsTable = dynamic(
  () => import('./components/ResultsTable').then(mod => mod.default),
  { ssr: false, loading: () => <SkeletonResults /> }
);
const SidePanels = dynamic(
  () => import('./components/SidePanels').then(mod => mod.default),
  { ssr: false, loading: () => null }
);
import ErrorAlert from './components/ErrorAlert';
import { getOwnedStatusStyle } from '../lib/ui/ownedStatus';

function PageInner() {
  // 未対応URLブロック: 現在はSpotifyプレイリストURLのみ対応
  const [banner, setBanner] = React.useState<null | { kind: "error" | "info"; text: string }>(null);

  // === HOOKS: Direct calls, no composition ===
  const analyzer = usePlaylistAnalyzer();
  const filters = useFiltersState();
  const selection = useSelectionState(null, false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  React.useEffect(() => {
    setBanner(null);
  }, [analyzer.playlistUrlInput]);

  const handleAnalyzeWithAppleBlock = (e: React.FormEvent) => {
    const url = analyzer.playlistUrlInput.trim();
    if (/music\.apple\.com/i.test(url)) {
      setBanner({ kind: "error", text: "このURLは未対応です。現在はSpotifyプレイリストURLのみ対応しています。" });
      return;
    }
    actions.handleAnalyze(e);
  };
    // --- clean-first-then-sync: 初回ロードはクリーン、以降は同期 ---
    const initialTabRef = useRef<string | null>(null);
    const allowUrlSyncRef = useRef(false);
  // Vercel / backend cold start warmup
  useEffect(() => {
  }, []);


  // === DERIVED DATA: Pure calculations ===
  // activeTab fallback logic after hydration
  useEffect(() => {
    if (!analyzer.multiResults || analyzer.multiResults.length === 0) {
      selection.setActiveTab(null);
      return;
    }
    const keys = analyzer.multiResults.map(([key]) => key);
    if (!selection.activeTab || !keys.includes(selection.activeTab)) {
      selection.setActiveTab(keys[keys.length - 1]);
    }
  }, [analyzer.multiResults, selection]);

  const vm = useViewModel(analyzer, filters, selection.activeTab);
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
    if (vm.multiResults.length === 0) return;

    const t = searchParams.get(TAB_QS_KEY);
    const decoded = t ? decodeTab(t) : null;

    let next: string | null = null;
    if (decoded && vm.multiResults.some(([u]) => u === decoded)) {
      next = decoded;
    } else {
      next = vm.multiResults[vm.multiResults.length - 1][0];
    }

    if (!selection.activeTab || (decoded && next === decoded)) {
      selection.setActiveTab(next);
    }

    if (t) {
      router.replace(pathname, { scroll: false });
    }
  }, [vm.multiResults, pathname, searchParams, selection, router]);

  // (2) タブ変更をURLへ同期（リロード耐性）
  useEffect(() => {
    const tab = selection.activeTab;
    if (!tab) return;

    // 初回はクリーン維持：initialTabから変わるまでURL同期を許可しない
    if (!allowUrlSyncRef.current) {
      if (initialTabRef.current && tab !== initialTabRef.current) {
        allowUrlSyncRef.current = true; // ここから“今まで通り”に戻す
      } else {
        return;
      }
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set(TAB_QS_KEY, encodeTab(tab));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
     
  }, [selection.activeTab, router, pathname, searchParams]);

  // === ACTIONS: All operations ===
  const actions = useActions(analyzer, selection);

  // === SIDE EFFECTS ===
    const { setFormCollapsed } = selection;
    const prevResultRef = useRef<unknown>(null);
    useEffect(() => {
      const r = vm.currentResult;
      const hasTracks = (r?.tracks?.length ?? 0) > 0;
      if (!hasTracks) return;
      if (r !== prevResultRef.current) {
        setFormCollapsed(true);
        prevResultRef.current = r;
      }
    }, [vm.currentResult, setFormCollapsed]);

  // タブ切替時にtracksが空ならensureHydratedで埋める
  useEffect(() => {
    const tab = selection.activeTab;
    if (!tab) return;
    const result = analyzer.multiResults.find(([url]) => url === tab)?.[1];
    if (!result || result.tracks.length !== 0) return;

    const ensureHydrated = (analyzer as Partial<{ ensureHydrated: (t: string) => void }>).ensureHydrated;
    if (typeof ensureHydrated === "function") ensureHydrated(tab);
  }, [selection.activeTab, analyzer]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
        {/* Apple-like minimalist header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-white tracking-tight">Playlist Shopper</h1>
          <p className="mt-2 text-base text-white/60">Match a Spotify playlist with your Rekordbox library, then open buy links.</p>
        </div>

        {/* Form */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-4">
          {analyzer.isProcessing && (
            <div className="text-[11px] text-slate-400">
              {analyzer.phaseLabel || 'Processing…'}
              {analyzer.progress < 10 && <span className="text-slate-500"> (server starting up…)</span>}
            </div>
          )}
          {vm.currentResult && selection.formCollapsed ? (
            <div className="flex items-center justify-between text-sm text-slate-200">
              <div className="flex items-center gap-3">
                {vm.currentResult.hasRekordboxData && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/20 px-2 py-0.5 text-[11px] text-emerald-200">
                    XML attached
                  </span>
                )}
                {/* XML meta info always visible when collapsed (from currentResult) */}
                {vm.currentResult?.rekordboxMeta && (
                  <span className="text-xs text-slate-400 ml-2">
                    XML: {vm.currentResult.rekordboxMeta.filename ?? '—'}
                    {vm.currentResult.rekordboxMeta.updatedAtISO && (
                      <span className="ml-2">Updated: {new Date(vm.currentResult.rekordboxMeta.updatedAtISO).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</span>
                    )}
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
              handleAnalyze={handleAnalyzeWithAppleBlock}
              rekordboxFile={analyzer.rekordboxFile}
              setRekordboxFile={analyzer.setRekordboxFile}
              handleRekordboxChange={analyzer.handleRekordboxChange}
              rekordboxFilename={analyzer.rekordboxFile?.name ?? vm.currentResult?.rekordboxMeta?.filename ?? null}
              rekordboxDate={analyzer.rekordboxDate ?? (vm.currentResult?.rekordboxMeta?.updatedAtISO ? new Date(vm.currentResult.rekordboxMeta.updatedAtISO).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : null)}
              loading={analyzer.loading}
              isReanalyzing={analyzer.isReanalyzing}
              progress={analyzer.progress}
              errorText={analyzer.errorText}
              errorMeta={analyzer.errorMeta}
              progressItems={analyzer.progressItems}
              setForceRefreshHint={analyzer.setForceRefreshHint}
              cancelAnalyze={actions.cancelAnalyze}
              retryFailed={actions.retryFailed}
              banner={banner}
              onDismissBanner={() => setBanner(null)}
            />
          )}
        </section>
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
            />
            {vm.currentResult && (
              <div className="space-y-4">
                <SidePanels
                  currentResult={vm.currentResult}
                  ownedCount={vm.ownedCount}
                  toBuyCount={vm.toBuyCount}
                  displayedTracks={vm.displayedTracks}
                  rekordboxFile={analyzer.rekordboxFile}
                  rekordboxDate={analyzer.rekordboxDate}
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
                <ResultsTable
                  currentResult={vm.currentResult}
                  displayedTracks={vm.displayedTracks}
                  categoryLabels={categoryLabels}
                  openStoreDropdown={selection.openStoreDropdown}
                  setOpenStoreDropdown={selection.setOpenStoreDropdown}
                  getOwnedStatusStyle={getOwnedStatusStyle}
                  // recommendedStore/otherStoresはResultsTable内でtrackごとに計算
                  isLoading={analyzer.isProcessing}
                  errorText={analyzer.errorText}
                  errorMeta={analyzer.errorMeta}
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

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PageInner />
    </Suspense>
  );
}
