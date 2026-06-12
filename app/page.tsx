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
import { categoryLabels } from "../lib/ui/selectors";
import { getOtherStores as _getOtherStores } from "../lib/playlist/stores";
import AnalyzeForm from "./components/AnalyzeForm";
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
import { getOwnedStatusStyle } from "../lib/ui/ownedStatus";
import { z } from "zod";
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
}: {
  items: QuietBuyLaterItem[];
  onRemove: (id: string) => void;
}) {
  return (
    <section className="border-t border-white/10 pt-6 text-xs text-slate-500">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="font-medium text-slate-400">
            Buy Later {items.length > 0 ? items.length : ""}
          </div>
          <div className="mt-2">Saved purchase candidates.</div>
        </div>
        {items.length > 0 ? (
          <button
            type="button"
            onClick={() => items.forEach((item) => onRemove(item.id))}
            className="text-slate-600 hover:text-slate-300"
          >
            Clear
          </button>
        ) : null}
      </div>

      <div className="mt-6 border-b border-white/10">
        {items.length === 0 ? (
          <div className="h-px" />
        ) : (
          <div className="divide-y divide-white/10">
            {items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[minmax(0,34%)_minmax(0,25%)_9%_minmax(0,20%)_12%] items-center"
              >
                <div className="min-w-0 px-3 py-4">
                  <QueueTitle item={item} />
                </div>
                <div className="min-w-0 px-3 py-4">
                  <div className="truncate text-slate-600">{item.artist}</div>
                  {item.album ? (
                    <div className="truncate text-slate-700">{item.album}</div>
                  ) : null}
                </div>
                <div className="px-3 py-4" />
                <div className="flex flex-wrap gap-2 px-3 py-4">
                  {isQueuePurchaseStore(item.buyStore) ? (
                    <a
                      href={item.buyUrl}
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
                    className="whitespace-nowrap text-slate-600 hover:text-slate-300"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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
  const buyQueue = useBuyQueue();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  React.useEffect(() => {
    setBanner(null);
  }, [analyzer.playlistUrlInput]);

  const handleAnalyzeWithAppleBlock = (e: React.FormEvent) => {
    const url = analyzer.playlistUrlInput.trim();
    if (/music\.apple\.com/i.test(url)) {
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

    const ensureHydrated = (
      analyzer as Partial<{ ensureHydrated: (t: string) => void }>
    ).ensureHydrated;
    if (typeof ensureHydrated === "function") ensureHydrated(tab);
  }, [selection.activeTab, analyzer]);

  return (
    <main className="min-h-screen bg-[#04060a] text-slate-50">
      <div className="mx-auto max-w-[1024px] px-4 py-12 sm:px-6 lg:py-14">
        <div className="space-y-12">
          <section>
            {analyzer.isProcessing && (
              <div className="mb-3 rounded-md border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-[11px] text-emerald-100/80">
                {analyzer.phaseLabel || "Processing…"}
                {analyzer.progress < 10 && (
                  <span className="text-slate-400"> Server starting up…</span>
                )}
              </div>
            )}
            <AnalyzeForm
              playlistUrlInput={analyzer.playlistUrlInput}
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
              errorText={analyzer.errorText}
              errorMeta={analyzer.errorMeta}
              progressItems={analyzer.progressItems}
              setForceRefreshHint={analyzer.setForceRefreshHint}
              cancelAnalyze={actions.cancelAnalyze}
              retryFailed={actions.retryFailed}
              banner={banner}
              onDismissBanner={() => setBanner(null)}
            />
          </section>
          {vm.multiResults.length === 0 && (
            <QuietBuyLater
              items={buyQueue.items}
              onRemove={buyQueue.removeItem}
            />
          )}
        </div>
        {/* Results */}
        {vm.multiResults.length > 0 && (
          <section className="mt-4 space-y-3" id="results-top">
            {vm.storageWarning && (
              <ErrorAlert
                title="Local data warning"
                message={vm.storageWarning}
                hint="Use Clear saved data to reset local storage, then re-run analysis."
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
                  handleExportCSV={() =>
                    actions.downloadCsv(vm.displayedTracks, vm.currentResult)
                  }
                />
                <div className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => filters.setCategoryFilter("all")}
                      className={`rounded px-2 py-1 ${
                        filters.categoryFilter === "all"
                          ? "bg-white/10 text-slate-100"
                          : "text-slate-500 hover:text-slate-200"
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => filters.setCategoryFilter("toBuy")}
                      className={`rounded px-2 py-1 ${
                        filters.categoryFilter === "toBuy"
                          ? "bg-amber-400/10 text-amber-100"
                          : "text-slate-500 hover:text-slate-200"
                      }`}
                    >
                      To buy
                    </button>
                    <button
                      type="button"
                      onClick={() => filters.setCategoryFilter("owned")}
                      className={`rounded px-2 py-1 ${
                        filters.categoryFilter === "owned"
                          ? "bg-emerald-400/10 text-emerald-100"
                          : "text-slate-500 hover:text-slate-200"
                      }`}
                    >
                      Owned
                    </button>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      placeholder="Search tracks"
                      value={filters.searchQuery}
                      onChange={(e) => filters.setSearchQuery(e.target.value)}
                      className="rounded border border-slate-800 bg-transparent px-2 py-1 text-xs text-slate-200 outline-none focus:border-slate-600"
                    />
                    <select
                      value={filters.sortKey}
                      onChange={(e) =>
                        filters.setSortKey(
                          e.target.value as typeof filters.sortKey,
                        )
                      }
                      className="rounded border border-slate-800 bg-[#04060a] px-2 py-1 text-xs text-slate-300 outline-none focus:border-slate-600"
                    >
                      <option value="none">Sort: None</option>
                      <option value="title">Sort: Title</option>
                      <option value="artist">Sort: Artist</option>
                      <option value="album">Sort: Album</option>
                    </select>
                  </div>
                </div>
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
                  queuedTrackIds={buyQueue.queuedIds}
                  onAddToBuyQueue={buyQueue.addTrack}
                />
                <QuietBuyLater
                  items={buyQueue.items}
                  onRemove={buyQueue.removeItem}
                />
                <details className="text-xs text-slate-500">
                  <summary className="cursor-pointer list-none font-medium text-slate-400">
                    Workspace utilities
                  </summary>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p>
                      Results are saved locally (~300KB cap). Clear to free
                      space.
                    </p>
                    <button
                      type="button"
                      onClick={() => actions.clearLocalData()}
                      className="self-start rounded border border-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-700 hover:text-slate-100"
                    >
                      Clear saved data
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
