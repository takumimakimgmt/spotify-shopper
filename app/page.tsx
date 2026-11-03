"use client";
// --- Gate-1 / FE-1: zod boundary validation for query params ---
const ActiveTabQuerySchema = z.string().trim().min(1);

function _parseActiveTabFromQuery(raw: string | null): string | null {
  const parsed = ActiveTabQuerySchema.safeParse(raw);
  if (!parsed.success) return null;
  return parsed.data;
}

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
import React, { useEffect, useRef, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePlaylistAnalyzer } from "../lib/state/usePlaylistAnalyzer";
import { useFiltersState } from "../lib/state/useFiltersState";
import { useSelectionState } from "../lib/state/useSelectionState";
import { useViewModel } from "../lib/state/useViewModel";
import { useActions } from "../lib/state/useActions";
import { useBuyQueue } from "../lib/state/useBuyQueue";
import { getOtherStores as _getOtherStores } from "../lib/playlist/stores";
import AnalyzeForm from "./components/AnalyzeForm";
import PlaylistQueryPrefill from "./components/PlaylistQueryPrefill";
import _ProgressList from "./components/ProgressList";
import { ShopperHeader as _ShopperHeader } from "./components/ShopperHeader";
import { ResultsTabs } from "./components/ResultsTabs";
import dynamic from "next/dynamic";
import SkeletonResults from "./components/SkeletonResults";
const ResultsTable = dynamic(
  () => import("./components/ResultsTable").then((mod) => mod.default),
  { ssr: false, loading: () => <SkeletonResults /> },
);
const SidePanels = dynamic(
  () => import("./components/SidePanels").then((mod) => mod.default),
  { ssr: false, loading: () => null },
);
import ErrorAlert from "./components/ErrorAlert";
import { z } from "zod";
import BuyLaterPanel from "./components/BuyLaterPanel";
// --- Gate-1 / FE-1: zod guard for query param boundary (tab) ---
const TabQuerySchema = z.string().trim().min(1).max(64);

function parseTabQuery(raw: string | null): string | null {
  const parsed = TabQuerySchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function PageInner() {
  // 未対応URLブロック: 現在はSpotifyプレイリストURLのみ対応
  const [banner, setBanner] = React.useState<null | {
    kind: "error" | "info";
    text: string;
  }>(null);

  // === HOOKS: Direct calls, no composition ===
  const analyzer = usePlaylistAnalyzer();
  const filters = useFiltersState();
  const selection = useSelectionState(null, false);
  const { activeTab, setActiveTab } = selection;
  const buyQueue = useBuyQueue();
  const resultsSectionRef = useRef<HTMLElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  React.useEffect(() => {
    setBanner(null);
  }, [analyzer.playlistUrlInput]);

  const handleAnalyzeWithAppleBlock = (e: React.FormEvent) => {
    const url = analyzer.playlistUrlInput.trim();
    if (/music\.apple\.com/i.test(url)) {
      e.preventDefault();
      setBanner({
        kind: "error",
        text: "This URL is not supported yet. Use a Spotify playlist URL.",
      });
      return;
    }
    actions.handleAnalyze(e);
  };
  // --- clean-first-then-sync: 初回ロードはクリーン、以降は同期 ---
  const initialTabRef = useRef<string | null>(null);
  const allowUrlSyncRef = useRef(false);
  // Vercel / backend cold start warmup
  useEffect(() => {}, []);

  // === DERIVED DATA: Pure calculations ===
  // activeTab fallback logic after hydration
  useEffect(() => {
    if (!analyzer.multiResults || analyzer.multiResults.length === 0) {
      setActiveTab(null);
      return;
    }
    const keys = analyzer.multiResults.map(([key]) => key);
    if (!activeTab || !keys.includes(activeTab)) {
      setActiveTab(keys[keys.length - 1]);
    }
  }, [analyzer.multiResults, activeTab, setActiveTab]);

  const vm = useViewModel(analyzer, filters, activeTab);
  const TAB_QS_KEY = "t";
  // URL(ASCII)を短く安全にクエリ化（base64url）
  const encodeTab = (url: string) =>
    btoa(url).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

  const decodeTab = (s: string) => {
    try {
      const padded =
        s.replace(/-/g, "+").replace(/_/g, "/") +
        "===".slice((s.length + 3) % 4);
      return atob(padded);
    } catch {
      return null;
    }
  };

  // (1) 初期タブ決定：URL(t) → なければ先頭
  useEffect(() => {
    if (vm.multiResults.length === 0) return;

    const t = parseTabQuery(searchParams.get(TAB_QS_KEY));
    const decoded = t ? decodeTab(t) : null;

    let next: string | null = null;
    if (decoded && vm.multiResults.some(([u]) => u === decoded)) {
      next = decoded;
    } else {
      next = vm.multiResults[vm.multiResults.length - 1][0];
    }

    if (initialTabRef.current === null) {
      initialTabRef.current = next;
    }

    if (!activeTab || (decoded && next === decoded)) {
      setActiveTab(next);
    }

    if (t) {
      router.replace(pathname, { scroll: false });
    }
  }, [
    vm.multiResults,
    pathname,
    searchParams,
    activeTab,
    setActiveTab,
    router,
  ]);

  // (2) タブ変更をURLへ同期（リロード耐性）
  useEffect(() => {
    const tab = activeTab;
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
  }, [activeTab, router, pathname, searchParams]);

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
      window.requestAnimationFrame(() => {
        resultsSectionRef.current?.focus({ preventScroll: true });
        resultsSectionRef.current?.scrollIntoView({ block: "start" });
      });
    }
  }, [vm.currentResult, setFormCollapsed]);

  useEffect(() => {
    if (vm.multiResults.length === 0) setFormCollapsed(false);
  }, [vm.multiResults.length, setFormCollapsed]);

  // タブ切替時にtracksが空ならensureHydratedで埋める
  useEffect(() => {
    const tab = activeTab;
    if (!tab) return;
    const result = analyzer.multiResults.find(([url]) => url === tab)?.[1];
    if (
      !result ||
      result.tracks.length !== 0 ||
      result.total === 0 ||
      result.errorText
    )
      return;

    void analyzer.ensureHydrated(tab);
  }, [activeTab, analyzer]);

  return (
    <main className="min-h-screen bg-[#04060a] text-slate-50">
      <PlaylistQueryPrefill
        setPlaylistUrlInput={analyzer.setPlaylistUrlInput}
      />
      <div className="mx-auto max-w-[1024px] px-4 py-12 sm:px-6 lg:py-14">
        <div className="space-y-10">
          {vm.storageWarning && (
            <div className="space-y-3">
              <ErrorAlert
                title="Local data warning"
                message={vm.storageWarning}
                hint="Keep this page open until saved data is safe. Clear analysis history removes saved results and progress only."
              />
              <button
                type="button"
                className="rounded border border-white/20 px-3 py-2 text-sm"
                onClick={actions.clearLocalData}
              >
                Clear analysis history and progress (keep XML and Buy Later)
              </button>
            </div>
          )}
          {analyzer.resumableDraft && !analyzer.isProcessing && (
            <div
              role="status"
              className="rounded-lg border border-amber-400/30 p-4 text-sm"
            >
              <p>
                {analyzer.resumableDraft.pendingUrls.length} playlists remain in
                the saved batch.
              </p>
              <p className="mt-1 text-slate-300">
                Completed results are kept. Processing pauses when this page
                closes. Resume checks remaining playlists using{" "}
                {analyzer.resumableDraft.useXml
                  ? `the currently selected XML (previous file: ${analyzer.resumableDraft.xmlFilename || "unknown"})`
                  : "no XML"}
                .
              </p>
              <div className="mt-3 flex gap-4">
                <button onClick={analyzer.resumeAnalysis}>
                  Resume remaining playlists
                </button>
                <button onClick={analyzer.discardAnalysisDraft}>
                  Discard saved progress (keep results)
                </button>
              </div>
            </div>
          )}
          <section>
            {selection.formCollapsed && vm.multiResults.length > 0 ? (
              <div className="flex items-center justify-between gap-4 border-b border-white/15 pb-5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">
                    Playlist Shopper
                  </p>
                  <p className="mt-1 truncate text-sm text-slate-400">
                    {vm.currentResult?.title ?? "Analysis results"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    selection.setFormCollapsed(false);
                    window.requestAnimationFrame(() => {
                      document.getElementById("playlist-url")?.focus();
                    });
                  }}
                  className="shrink-0 rounded-md border border-white/20 px-3 py-2 text-sm font-medium text-slate-100 hover:border-white/40 hover:bg-white/5"
                >
                  New analysis
                </button>
              </div>
            ) : (
              <>
                <header className="mb-8 max-w-3xl space-y-3">
                  <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">
                    Playlist Shopper
                  </p>
                  <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    Find missing tracks in Rekordbox.
                  </h1>
                  <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                    Check a Spotify playlist against your library and build a
                    focused purchase list.
                  </p>
                </header>
                <AnalyzeForm
                  playlistUrlInput={analyzer.playlistUrlInput}
                  activePlaylistInput={
                    selection.activeTab ?? vm.currentResult?.playlistUrl
                  }
                  activePlaylistId={vm.currentResult?.playlist_id}
                  queryPlaylist={searchParams.get("playlist")}
                  setPlaylistUrlInput={analyzer.setPlaylistUrlInput}
                  handleAnalyze={handleAnalyzeWithAppleBlock}
                  rekordboxFile={analyzer.rekordboxFile}
                  setRekordboxFile={analyzer.setRekordboxFile}
                  handleRekordboxChange={analyzer.handleRekordboxChange}
                  rekordboxFilename={analyzer.rekordboxFile?.name ?? null}
                  rekordboxDate={analyzer.rekordboxDate}
                  savedRekordboxXmlMeta={analyzer.savedRekordboxXmlMeta}
                  savedRekordboxXmlBusy={analyzer.savedRekordboxXmlBusy}
                  savedRekordboxXmlError={analyzer.savedRekordboxXmlError}
                  useSavedRekordboxXml={analyzer.useSavedRekordboxXml}
                  forgetSavedRekordboxXml={analyzer.forgetSavedRekordboxXml}
                  loading={analyzer.loading}
                  isReanalyzing={analyzer.isReanalyzing}
                  progress={analyzer.progress}
                  phaseLabel={analyzer.phaseLabel}
                  errorText={analyzer.errorText}
                  errorMeta={analyzer.errorMeta}
                  progressItems={analyzer.progressItems}
                  setForceRefreshHint={analyzer.setForceRefreshHint}
                  cancelAnalyze={actions.cancelAnalyze}
                  retryFailed={actions.retryFailed}
                  banner={banner}
                  onDismissBanner={() => setBanner(null)}
                />
              </>
            )}
          </section>
          {vm.multiResults.length === 0 && (
            <BuyLaterPanel
              items={buyQueue.items}
              onRemove={buyQueue.removeItem}
              storageWarning={buyQueue.storageWarning}
              onRetrySave={buyQueue.retrySave}
            />
          )}
        </div>
        {/* Results */}
        {vm.multiResults.length > 0 && (
          <section
            ref={resultsSectionRef}
            className="scroll-mt-4 space-y-4 outline-none"
            id="results-top"
            tabIndex={-1}
            aria-label="Analysis results"
          >
            {/* Tabs */}
            <ResultsTabs
              multiResults={vm.multiResults}
              activeTab={selection.activeTab}
              onSelectTab={selection.setActiveTab}
              onRemoveTab={actions.handleRemoveTab}
            />
            {vm.currentResult && (
              <div className="space-y-3">
                {vm.currentResult.errorText && (
                  <div
                    role="alert"
                    className="rounded border border-rose-400/30 p-3 text-sm text-rose-200"
                  >
                    <p>{vm.currentResult.errorText}</p>
                    <button
                      type="button"
                      onClick={() =>
                        selection.activeTab &&
                        void analyzer.ensureHydrated(selection.activeTab, true)
                      }
                      className="mt-2 rounded border border-white/20 px-3 py-2"
                    >
                      Retry loading playlist
                    </button>
                  </div>
                )}
                <SidePanels
                  currentResult={vm.currentResult}
                  ownedCount={vm.ownedCount}
                  toBuyCount={vm.toBuyCount}
                  unknownCount={vm.unknownCount}
                  displayedTracks={vm.displayedTracks}
                  rekordboxFile={analyzer.rekordboxFile}
                  rekordboxDate={analyzer.rekordboxDate}
                  applySnapshotWithXml={async (file, result, tracks) => {
                    await actions.applySnapshotWithXml(file, result, tracks);
                  }}
                  handleExportCSV={() =>
                    actions.downloadCsv(vm.displayedTracks, vm.currentResult)
                  }
                />
                <div className="flex flex-col gap-4 border-y border-white/10 py-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="mb-2 text-sm font-medium text-slate-300">
                      Show tracks
                    </div>
                    <div
                      className="flex flex-wrap gap-1.5"
                      role="group"
                      aria-label="Track status filter"
                    >
                      <button
                        type="button"
                        onClick={() => filters.setCategoryFilter("all")}
                        className={`min-h-9 rounded-md px-3 py-1.5 text-sm ${
                          filters.categoryFilter === "all"
                            ? "bg-white/10 text-slate-100"
                            : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                        }`}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => filters.setCategoryFilter("toBuy")}
                        className={`min-h-9 rounded-md px-3 py-1.5 text-sm ${
                          filters.categoryFilter === "toBuy"
                            ? "bg-amber-400/10 text-amber-100"
                            : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                        }`}
                      >
                        Not in XML
                      </button>
                      <button
                        type="button"
                        onClick={() => filters.setCategoryFilter("owned")}
                        className={`min-h-9 rounded-md px-3 py-1.5 text-sm ${
                          filters.categoryFilter === "owned"
                            ? "bg-emerald-400/10 text-emerald-100"
                            : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                        }`}
                      >
                        Matches XML
                      </button>
                      <button
                        type="button"
                        aria-pressed={filters.categoryFilter === "unknown"}
                        onClick={() => filters.setCategoryFilter("unknown")}
                        className={`min-h-9 rounded-md px-3 py-1.5 text-sm ${filters.categoryFilter === "unknown" ? "bg-amber-400/10 text-amber-100" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"}`}
                      >
                        Not confirmed
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(12rem,1fr)_auto]">
                    <label className="text-sm font-medium text-slate-300">
                      <span className="mb-2 block">Search</span>
                      <input
                        type="search"
                        placeholder="Title, artist, or album"
                        value={filters.searchQuery}
                        onChange={(e) => filters.setSearchQuery(e.target.value)}
                        className="min-h-9 w-full rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/40"
                      />
                    </label>
                    <label className="text-sm font-medium text-slate-300">
                      <span className="mb-2 block">Sort</span>
                      <select
                        value={filters.sortKey}
                        onChange={(e) =>
                          filters.setSortKey(
                            e.target.value as typeof filters.sortKey,
                          )
                        }
                        className="min-h-9 w-full rounded-md border border-white/15 bg-[#04060a] px-3 py-2 text-sm text-slate-200 outline-none focus:border-white/40"
                      >
                        <option value="none">Sort: None</option>
                        <option value="title">Sort: Title</option>
                        <option value="artist">Sort: Artist</option>
                        <option value="album">Sort: Album</option>
                      </select>
                    </label>
                  </div>
                </div>
                {analyzer.savedRekordboxXmlError && (
                  <p role="alert" className="text-sm text-amber-200">
                    {analyzer.savedRekordboxXmlError}
                  </p>
                )}
                <ResultsTable
                  emptyMessage={
                    filters.searchQuery.trim()
                      ? "No tracks match your search."
                      : filters.categoryFilter === "toBuy" &&
                          vm.unknownCount > 0
                        ? "No tracks are confirmed absent from this XML. Review the not-confirmed tracks before buying."
                        : filters.categoryFilter === "toBuy" &&
                            vm.ownedCount > 0
                          ? "All checked tracks have a match in this XML."
                          : vm.currentResult.tracks.length === 0
                            ? "No analyzable tracks were returned. Check skipped entries or retry loading the playlist."
                            : "No tracks in this filter."
                  }
                  onResetFilters={
                    filters.searchQuery.trim() ||
                    filters.categoryFilter !== "all"
                      ? () => {
                          filters.setSearchQuery("");
                          filters.setCategoryFilter("all");
                        }
                      : undefined
                  }
                  currentResult={vm.currentResult}
                  displayedTracks={vm.displayedTracks}
                  queuedTrackIds={buyQueue.queuedIds}
                  onAddToBuyQueue={buyQueue.addTrack}
                />
                <BuyLaterPanel
                  items={buyQueue.items}
                  onRemove={buyQueue.removeItem}
                  storageWarning={buyQueue.storageWarning}
                  onRetrySave={buyQueue.retrySave}
                />
                <details className="text-xs text-slate-500">
                  <summary className="cursor-pointer list-none font-medium text-slate-400">
                    Workspace utilities
                  </summary>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p>
                      Analysis snapshots are saved on this device. Clearing
                      history keeps your saved XML and Buy Later list.
                    </p>
                    <button
                      type="button"
                      onClick={() => actions.clearLocalData()}
                      className="self-start rounded border border-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-700 hover:text-slate-100"
                    >
                      Clear analysis history
                    </button>
                  </div>
                </details>
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
