"use client";
import { latestQueueEvidence } from "@/lib/domain/buyQueueEvidence";
import ResultsFilterBar from "./components/ResultsFilterBar";
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
import { useI18n } from "@/lib/i18n/LanguageProvider";
import React, { useEffect, useRef, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePlaylistAnalyzer } from "../lib/state/usePlaylistAnalyzer";
import { useFiltersState } from "../lib/state/useFiltersState";
import { useSelectionState } from "../lib/state/useSelectionState";
import { useReviewDecisions } from "../lib/state/useReviewDecisions";
import { useViewModel } from "../lib/state/useViewModel";
import { useActions } from "../lib/state/useActions";
import {
  buyLaterBatch,
  buyLaterBatchSummary,
} from "@/lib/domain/buyLaterBatch";
import { getBuyQueueItemId, useBuyQueue } from "../lib/state/useBuyQueue";
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
import SpotifyConnection from "./components/SpotifyConnection";
import LanguageSwitcher from "./components/LanguageSwitcher";
import PurchasePlan from "./components/PurchasePlan";
import BuyLaterDrawer from "./components/BuyLaterDrawer";
// --- Gate-1 / FE-1: zod guard for query param boundary (tab) ---
const TabQuerySchema = z.string().trim().min(1).max(64);

function parseTabQuery(raw: string | null): string | null {
  const parsed = TabQuerySchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function PageInner() {
  const { t: tr } = useI18n();

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
  const [queueOpen, setQueueOpen] = React.useState(false);
  const [queueNotice, setQueueNotice] = React.useState<{
    title?: string;
    count?: number;
  } | null>(null);
  useEffect(() => {
    if (!queueNotice) return;
    const timer = window.setTimeout(() => setQueueNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [queueNotice]);
  const saveForLater: typeof buyQueue.addTrack = (track, link) => {
    if (buyQueue.queuedIds.has(getBuyQueueItemId(track))) return false;
    const added = buyQueue.addTrack(track, link, evidenceContext(track));
    if (added) setQueueNotice({ title: track.title });
    return added;
  };
  const queueButton = () => (
    <button
      type="button"
      onClick={() => setQueueOpen(true)}
      aria-controls="buy-later-drawer"
      aria-haspopup="dialog"
      aria-expanded={queueOpen}
      className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-4 text-sm font-semibold text-slate-200 hover:border-white/35 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-emerald-300"
    >
      {tr("Buy Later")}{" "}
      <span className="rounded-full bg-emerald-200/15 px-2 py-0.5 text-xs tabular-nums">
        {buyQueue.items.length}
      </span>
      {buyQueue.storageWarning && (
        <span aria-label={tr("Local data warning")}>!</span>
      )}
    </button>
  );
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
    if (!analyzer.storageHydrated || !selection.selectionHydrated) return;
    if (!analyzer.multiResults || analyzer.multiResults.length === 0) {
      setActiveTab(null);
      return;
    }
    const keys = analyzer.multiResults.map(([key]) => key);
    if (!activeTab || !keys.includes(activeTab)) {
      setActiveTab(keys[0]);
    }
  }, [
    analyzer.multiResults,
    analyzer.storageHydrated,
    selection.selectionHydrated,
    activeTab,
    setActiveTab,
  ]);

  const reviews = useReviewDecisions();
  const vm = useViewModel(analyzer, filters, activeTab, reviews.decisions);
  // Default once per playlist / matching revision, preserving manual filter choices.
  const defaultFilterKey = vm.currentResult
    ? JSON.stringify([
        activeTab,
        !!vm.currentResult.hasRekordboxData,
        vm.currentResult.meta?.rekordbox?.matched_at,
        vm.currentResult.meta?.rekordbox?.library_sha256,
      ])
    : null;
  const lastDefaultFilter = useRef<string | null>(null);
  const { setCategoryFilter } = filters;
  const hasMatchedXml = !!vm.currentResult?.hasRekordboxData;
  useEffect(() => {
    if (!defaultFilterKey || lastDefaultFilter.current === defaultFilterKey)
      return;
    lastDefaultFilter.current = defaultFilterKey;
    setCategoryFilter(hasMatchedXml ? "toBuy" : "all");
  }, [defaultFilterKey, hasMatchedXml, setCategoryFilter]);
  function evidenceContext(track?: import("@/lib/types").PlaylistRow) {
    const result = track
      ? vm.multiResults.find(([, r]) =>
          r.tracks.some(
            (t) => getBuyQueueItemId(t) === getBuyQueueItemId(track),
          ),
        )?.[1]
      : vm.currentResult;
    return {
      checkedAt: result?.meta?.rekordbox?.matched_at,
      xmlFilename: result?.rekordboxMeta?.filename,
      rulesVersion: result?.meta?.ownership_rules_version,
      libraryFingerprint: result?.meta?.rekordbox?.library_sha256,
    };
  }
  const currentQueueEvidence = React.useMemo(
    () => latestQueueEvidence(vm.multiResults, buyQueue.queuedIds),
    [vm.multiResults, buyQueue.queuedIds],
  );
  const queueItems = buyQueue.items.map((item) => ({
    ...item,
    currentEvidence: currentQueueEvidence.get(item.id),
  }));
  const saveBatch = buyLaterBatch(vm.displayedTracks, buyQueue.queuedIds);
  const saveFilteredTracks = () => {
    const count = buyQueue.addTracks(saveBatch, evidenceContext());
    if (count > 0) setQueueNotice({ count });
  };
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
      next = vm.multiResults[0][0];
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
  const pendingCompletionRef = useRef<typeof analyzer.lastCompleted>(null);
  const seenCompletionRef = useRef<typeof analyzer.lastCompleted>(null);
  useEffect(() => {
    if (analyzer.lastCompleted !== seenCompletionRef.current) {
      seenCompletionRef.current = analyzer.lastCompleted;
      pendingCompletionRef.current = analyzer.lastCompleted;
    }
    const completed = pendingCompletionRef.current;
    if (!completed) return;
    setActiveTab(completed.key);
    if (!analyzer.loading) {
      pendingCompletionRef.current = null;
      if (analyzer.errorText) return;
      setFormCollapsed(true);
      window.requestAnimationFrame(() => {
        resultsSectionRef.current?.focus({ preventScroll: true });
        resultsSectionRef.current?.scrollIntoView({ block: "start" });
      });
    }
  }, [
    analyzer.lastCompleted,
    analyzer.loading,
    analyzer.errorText,
    setActiveTab,
    setFormCollapsed,
  ]);

  useEffect(() => {
    if (
      analyzer.storageHydrated &&
      selection.selectionHydrated &&
      vm.multiResults.length === 0
    )
      setFormCollapsed(false);
  }, [
    vm.multiResults.length,
    analyzer.storageHydrated,
    selection.selectionHydrated,
    setFormCollapsed,
  ]);

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
    <main className="min-h-screen bg-canvas text-foreground">
      <PlaylistQueryPrefill
        setPlaylistUrlInput={analyzer.setPlaylistUrlInput}
      />
      <div
        className={`mx-auto max-w-[1200px] px-4 sm:px-6 ${vm.multiResults.length ? "py-5 lg:py-6" : "py-6 lg:py-8"}`}
      >
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <p className="text-sm font-semibold tracking-wide text-secondary">
            Playlist Shopper
          </p>
          <div className="flex items-center gap-3">
            {!selection.formCollapsed && queueButton()}
            <LanguageSwitcher compact />
          </div>
        </header>
        <BuyLaterDrawer
          open={queueOpen}
          onClose={() => setQueueOpen(false)}
          items={queueItems}
          onRemove={buyQueue.removeItem}
          onClear={buyQueue.clearItems}
          onUndoRemove={buyQueue.undoRemove}
          removedCount={buyQueue.removedCount}
          storageWarning={buyQueue.storageWarning}
          onRetrySave={buyQueue.retrySave}
        />
        {queueNotice && !buyQueue.storageWarning && (
          <div
            role="status"
            className="fixed bottom-5 left-1/2 z-40 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-4 rounded-xl border border-emerald-300/30 bg-[#14231f] px-5 py-3 text-sm text-emerald-100 shadow-xl"
          >
            <span className="truncate">
              {queueNotice.title
                ? tr("Added {title} to Buy Later", { title: queueNotice.title })
                : tr(
                    queueNotice.count === 1
                      ? "Added {count} track to Buy Later"
                      : "Added {count} tracks to Buy Later",
                    {
                      count: queueNotice.count ?? 0,
                    },
                  )}
            </span>
            <button
              type="button"
              onClick={() => {
                setQueueOpen(true);
                setQueueNotice(null);
              }}
              className="shrink-0 underline underline-offset-4"
            >
              {tr("View saved tracks")}
            </button>
          </div>
        )}
        {buyQueue.storageWarning && !queueOpen && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-amber-300/30 p-3 text-sm text-amber-200"
          >
            {tr(buyQueue.storageWarning)}{" "}
            <button
              type="button"
              onClick={() => setQueueOpen(true)}
              className="ml-2 underline"
            >
              {tr("View saved tracks")}
            </button>
          </div>
        )}
        <SpotifyConnection />
        <div className="space-y-10">
          {reviews.warning && (
            <div role="alert" className="space-y-2 text-sm text-amber-200">
              <p>{tr(reviews.warning)}</p>
              <button type="button" onClick={reviews.clearAll}>
                {tr("Clear saved confirmations (keep XML and results)")}
              </button>
            </div>
          )}
          {vm.storageWarning && (
            <div className="space-y-3">
              <ErrorAlert
                title={tr("Local data warning")}
                message={vm.storageWarning}
                hint={tr(
                  "Keep this page open until saved data is safe. Clear analysis history removes saved results and progress only.",
                )}
              />
              <button
                type="button"
                className="rounded border border-white/20 px-3 py-2 text-sm"
                onClick={actions.clearLocalData}
              >
                {tr(
                  "Clear analysis history and progress (keep XML and Buy Later)",
                )}
              </button>
            </div>
          )}
          {analyzer.resumableDraft && !analyzer.isProcessing && (
            <details className="border-b border-white/15 py-2 text-sm">
              <summary className="cursor-pointer py-2">
                {tr("Saved progress: {count} remaining", {
                  count: analyzer.resumableDraft.pendingUrls.length,
                })}
              </summary>
              <p>
                {tr(
                  analyzer.resumableDraft.pendingUrls.length === 1
                    ? "{count} playlist remains in the saved batch."
                    : "{count} playlists remain in the saved batch.",
                  { count: analyzer.resumableDraft.pendingUrls.length },
                )}
              </p>
              <p className="mt-1 text-secondary">
                {tr(
                  "Completed results are kept. Processing pauses when this page closes. Resume checks remaining playlists using",
                )}{" "}
                {analyzer.resumableDraft.useXml
                  ? tr("the currently selected XML (previous file: {file})", {
                      file:
                        analyzer.resumableDraft.xmlFilename || tr("unknown"),
                    })
                  : tr("no XML")}
                .
              </p>
              <div className="mt-3 flex gap-4">
                <button onClick={analyzer.resumeAnalysis}>
                  {tr("Resume remaining playlists")}
                </button>
                <button onClick={analyzer.discardAnalysisDraft}>
                  {tr("Discard saved progress (keep results)")}
                </button>
              </div>
            </details>
          )}
          <section>
            {selection.formCollapsed && vm.multiResults.length > 0 ? (
              <div className="flex items-center justify-between gap-4 border-b border-white/15 pb-5">
                <div className="min-w-0">
                  <h1 className="break-words text-2xl font-semibold tracking-tight text-foreground">
                    {vm.currentResult?.title ?? tr("Playlist results")}
                  </h1>
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
                  {tr("Check another playlist")}
                </button>
              </div>
            ) : (
              <>
                {vm.multiResults.length > 0 && (
                  <div className="mx-auto max-w-3xl">
                    <button
                      type="button"
                      className="ps-action-secondary"
                      onClick={() => selection.setFormCollapsed(true)}
                    >
                      {tr("Back to saved results")}
                    </button>
                    <p className="mt-2 text-sm text-muted">
                      {tr(
                        "Your previous results, XML and Buy Later are kept. A successful check opens the new playlist.",
                      )}
                    </p>
                  </div>
                )}
                <header className="ps-intro mx-auto mb-7 max-w-3xl space-y-3 border-b border-white/15 pb-6">
                  <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                    {tr("Buy new tracks. Skip the duplicates.")}
                  </h1>
                  <p className="max-w-2xl text-sm leading-6 text-secondary sm:text-base">
                    {tr(
                      "Compare a Spotify playlist with your rekordbox XML, then find tracks to buy on Beatport.",
                    )}
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
        </div>
        {/* Results */}
        {vm.multiResults.length > 0 && selection.formCollapsed && (
          <section
            ref={resultsSectionRef}
            className="scroll-mt-4 space-y-4 outline-none"
            id="results-top"
            tabIndex={-1}
            aria-label={tr("Playlist results")}
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
                    <p>{tr(vm.currentResult.errorText)}</p>
                    <button
                      type="button"
                      onClick={() =>
                        selection.activeTab &&
                        void analyzer.ensureHydrated(selection.activeTab, true)
                      }
                      className="mt-2 rounded border border-white/20 px-3 py-2"
                    >
                      {tr("Retry loading playlist")}
                    </button>
                  </div>
                )}
                <ResultsFilterBar
                  result={vm.currentResult}
                  filters={filters}
                  queue={queueButton()}
                />
                <SidePanels
                  currentResult={vm.currentResult}
                  ownedCount={vm.ownedCount}
                  toBuyCount={vm.toBuyCount}
                  unknownCount={vm.unknownCount}
                  displayedTracks={vm.displayedTracks}
                  rekordboxFile={analyzer.rekordboxFile}
                  rekordboxDate={analyzer.rekordboxDate}
                  applySnapshotWithXml={async (file, result, tracks) => {
                    await actions.applySnapshotWithXml(
                      file,
                      analyzer.multiResults.find(
                        ([key]) => key === activeTab,
                      )?.[1] ?? result,
                      tracks,
                    );
                  }}
                  handleExportCSV={() =>
                    actions.downloadCsv(vm.displayedTracks, vm.currentResult)
                  }
                />
                {analyzer.savedRekordboxXmlError && (
                  <p role="alert" className="text-sm text-amber-200">
                    {tr(analyzer.savedRekordboxXmlError)}
                  </p>
                )}
                {vm.currentResult.changeSummary?.hasPrevious && (
                  <details className="text-sm text-muted">
                    <summary className="cursor-pointer py-1">
                      {tr("Changes since the last check")}
                    </summary>
                    <label className="mt-2 flex items-center gap-2 text-sm text-secondary">
                      <input
                        type="checkbox"
                        checked={filters.changesOnly}
                        onChange={(event) =>
                          filters.setChangesOnly(event.target.checked)
                        }
                      />
                      {tr("Show added, changed or rechecked tracks only")}
                    </label>
                  </details>
                )}
                <ResultsTable
                  showChanges={!!vm.currentResult.changeSummary?.hasPrevious}
                  compactStatus={filters.categoryFilter === "toBuy"}
                  onSaveBatch={saveFilteredTracks}
                  onOpenBuyQueue={() => setQueueOpen(true)}
                  saveBatchCount={saveBatch.length}
                  saveBatchSummary={buyLaterBatchSummary(
                    vm.displayedTracks,
                    buyQueue.queuedIds,
                  )}
                  paginationKey={JSON.stringify([
                    selection.activeTab,
                    filters.categoryFilter,
                    filters.searchQuery,
                    filters.sortKey,
                    filters.changesOnly,
                  ])}
                  emptyMessage={
                    filters.changesOnly &&
                    vm.currentResult.changeSummary?.hasPrevious &&
                    vm.currentResult.tracks.every(
                      (t) => t.changeStatus === tr("unchanged"),
                    )
                      ? tr(
                          "Nothing changed since the last analysis. Show all tracks to review the full playlist.",
                        )
                      : filters.searchQuery.trim()
                        ? tr("No tracks match your search.")
                        : filters.categoryFilter === "toBuy" &&
                            !vm.currentResult.hasRekordboxData
                          ? tr(
                              "Add XML to check which tracks are absent from your library export.",
                            )
                          : filters.categoryFilter === "toBuy" &&
                              vm.unknownCount > 0
                            ? tr(
                                "No tracks are confirmed absent from this XML. Review the not-confirmed tracks before buying.",
                              )
                            : filters.categoryFilter === "toBuy" &&
                                vm.ownedCount > 0
                              ? tr(
                                  "All checked tracks have a match in this XML.",
                                )
                              : vm.currentResult.tracks.length === 0
                                ? tr(
                                    "No analyzable tracks were returned. Check skipped entries or retry loading the playlist.",
                                  )
                                : tr("No tracks in this filter.")
                  }
                  onResetFilters={
                    filters.changesOnly ||
                    filters.searchQuery.trim() ||
                    filters.categoryFilter !== "all"
                      ? () => {
                          filters.setChangesOnly(false);
                          filters.setSearchQuery("");
                          filters.setCategoryFilter("all");
                        }
                      : undefined
                  }
                  onReviewDecision={(track, action) =>
                    reviews.decide(
                      track,
                      action,
                      vm.currentResult?.meta?.rekordbox?.library_sha256,
                      vm.currentResult?.meta?.ownership_rules_version,
                    )
                  }
                  reviewReady={reviews.ready}
                  currentResult={vm.currentResult}
                  displayedTracks={vm.displayedTracks}
                  queuedTrackIds={buyQueue.queuedIds}
                  onAddToBuyQueue={saveForLater}
                />

                <PurchasePlan
                  results={vm.multiResults}
                  queuedIds={buyQueue.queuedIds}
                  onSave={saveForLater}
                />
                <details className="text-xs text-muted">
                  <summary className="cursor-pointer list-none font-medium text-muted">
                    {tr("Saved data and tools")}
                  </summary>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p>
                      {tr(
                        "Playlist results are saved on this device. Clearing history keeps your saved XML, Buy Later list and confirmations.",
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={() => actions.clearLocalData()}
                      className="self-start rounded border border-slate-800 px-3 py-1.5 text-xs font-medium text-secondary hover:border-slate-700 hover:text-slate-100"
                    >
                      {tr("Clear analysis history")}
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
