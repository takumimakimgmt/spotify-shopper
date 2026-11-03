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
  - MAX_XML_BYTES = 3 * 1024 * 1024
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
import { withBeatportAid } from "../lib/affiliates/beatport";
// --- Gate-1 / FE-1: zod guard for query param boundary (tab) ---
const TabQuerySchema = z.string().trim().min(1).max(64);

function parseTabQuery(raw: string | null): string | null {
  const parsed = TabQuerySchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

type QuietBuyLaterItem = {
  id: string;
  title: string;
  artist: string;
  album?: string;
  spotifyUrl?: string;
  buyUrl: string;
  buyStore: string;
};

function queueListenUrl(item: QuietBuyLaterItem): string {
  if (item.spotifyUrl) return item.spotifyUrl;

  const q = [item.artist, item.title, "topic"].filter(Boolean).join(" ");
  if (!q) return "";
  const proto = ["ht", "tps", ":", "//"].join("");
  const host = ["music", "youtube", "com"].join(".");
  return `${proto}${host}/search?q=${encodeURIComponent(q)}`;
}

function isQueuePurchaseStore(store: string): boolean {
  return store === "Beatport" || store === "Bandcamp";
}

function QueueTitle({ item }: { item: QuietBuyLaterItem }) {
  const href = queueListenUrl(item);

  if (!href) {
    return (
      <div className="truncate text-sm font-medium text-slate-300">
        {item.title}
      </div>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`Listen to ${item.title}`}
      className="inline-block max-w-full truncate border-b border-white/25 pb-0.5 text-sm font-medium text-slate-200 hover:border-white/60 hover:text-white focus-visible:rounded-sm focus-visible:border-white/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
    >
      {item.title}
    </a>
  );
}

function QuietBuyLater({
  items,
  onRemove,
  storageWarning,
  onRetrySave,
}: {
  items: QuietBuyLaterItem[];
  onRemove: (id: string) => void;
  storageWarning?: string | null;
  onRetrySave?: () => void;
}) {
  if (items.length === 0 && !storageWarning) return null;

  return (
    <section className="border-t border-white/15 pt-6 text-sm text-slate-400">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-200">Buy Later</div>
          <div className="mt-2">Saved purchase candidates.</div>
        </div>
        <button
          type="button"
          onClick={() => items.forEach((item) => onRemove(item.id))}
          className="text-slate-400 hover:text-slate-100"
        >
          Clear
        </button>
      </div>

      {storageWarning && (
        <div role="alert" className="mt-3 text-amber-200">
          <p>{storageWarning}</p>
          <button
            type="button"
            onClick={onRetrySave}
            className="mt-2 rounded border border-white/20 px-3 py-2"
          >
            Retry storage
          </button>
        </div>
      )}
      <div className="mt-6 border-b border-white/10">
        <div className="divide-y divide-white/10">
          {items.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-1 items-center rounded-lg border border-white/10 p-2 md:grid-cols-[minmax(0,34%)_minmax(0,25%)_9%_minmax(0,20%)_12%] md:rounded-none md:border-0 md:p-0"
            >
              <div className="min-w-0 px-3 py-4">
                <QueueTitle item={item} />
              </div>
              <div className="min-w-0 px-3 py-4">
                <div className="truncate text-slate-400">{item.artist}</div>
                {item.album ? (
                  <div className="truncate text-slate-500">{item.album}</div>
                ) : null}
              </div>
              <div className="hidden px-3 py-4 md:block" />
              <div className="flex flex-wrap gap-2 px-3 py-4">
                {isQueuePurchaseStore(item.buyStore) ? (
                  <a
                    href={withBeatportAid(item.buyUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="whitespace-nowrap rounded border border-slate-800 px-2 py-1 text-slate-400 hover:border-slate-700 hover:text-slate-100"
                  >
                    {item.buyStore}
                  </a>
                ) : null}
              </div>
              <div className="px-3 py-4">
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="whitespace-nowrap text-slate-400 hover:text-slate-300"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
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
            <QuietBuyLater
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
            {vm.storageWarning && (
              <ErrorAlert
                title="Local data warning"
                message={vm.storageWarning}
                hint="Free browser storage and retry analysis. Clear analysis history removes saved results only."
              />
            )}
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
                        To buy
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
                        Owned
                      </button>
                      <button
                        type="button"
                        aria-pressed={filters.categoryFilter === "unknown"}
                        onClick={() => filters.setCategoryFilter("unknown")}
                        className={`min-h-9 rounded-md px-3 py-1.5 text-sm ${filters.categoryFilter === "unknown" ? "bg-amber-400/10 text-amber-100" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"}`}
                      >
                        Unverified
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
                        ? "No confirmed missing tracks. Check Unverified tracks before buying."
                        : filters.categoryFilter === "toBuy" &&
                            vm.ownedCount > 0
                          ? "All checked tracks are owned."
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
                <QuietBuyLater
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
