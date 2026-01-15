import React from "react";
import type { SortKey, ResultState } from "../../lib/types";

type Props = {
  currentResult: ResultState | null;
  categoryFilter: "all" | "toBuy" | "owned";
  setCategoryFilter: (val: "all" | "toBuy" | "owned") => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  sortKey: SortKey;
  setSortKey: (key: SortKey) => void;
  onExportCsv: () => void;
  onReanalyzeXmlClick: () => void;
};

export function ResultsControls({
  currentResult,
  categoryFilter,
  setCategoryFilter,
  searchQuery,
  setSearchQuery,
  sortKey,
  setSortKey,
  onExportCsv,
  onReanalyzeXmlClick,
}: Props) {
  if (!currentResult) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
        <div className="flex items-start gap-3">
          <div className="text-slate-200">
            <div className="font-semibold text-lg">{currentResult.title}</div>
            <div className="text-xs text-slate-400">
              {currentResult.playlistUrl}
            </div>
            <div className="text-xs text-slate-400">
              Tracks: {currentResult.total}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-start md:justify-end items-center">
          <button
            onClick={onReanalyzeXmlClick}
            className="px-3 py-1.5 rounded bg-slate-700 border border-slate-600 text-slate-200 text-xs font-medium hover:bg-slate-600"
            type="button"
          >
            Re-analyze with XML
          </button>
          <button
            onClick={onExportCsv}
            className="px-3 py-1.5 rounded bg-slate-700 border border-slate-600 text-slate-200 text-xs font-medium hover:bg-slate-600"
            type="button"
          >
            Export as CSV
          </button>
        </div>
      </div>

      {/* Category toggle */}
      <div className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur border border-slate-800 rounded-xl p-4">
        <div className="flex gap-2">
          <button
            onClick={() => setCategoryFilter("all")}
            className={`flex-1 px-3 py-1 rounded border text-xs transition ${categoryFilter === "all" ? "bg-slate-700 border-slate-500 text-slate-100" : "bg-slate-800/40 border-slate-700 text-slate-300 hover:bg-slate-800"}`}
          >
            All
          </button>
          <button
            onClick={() => setCategoryFilter("toBuy")}
            className={`flex-1 px-3 py-1 rounded border text-xs transition ${categoryFilter === "toBuy" ? "bg-amber-500/30 border-amber-500 text-amber-200" : "bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20"}`}
          >
            To buy
          </button>
          <button
            onClick={() => setCategoryFilter("owned")}
            className={`flex-1 px-3 py-1 rounded border text-xs transition ${categoryFilter === "owned" ? "bg-emerald-500/30 border-emerald-500 text-emerald-100" : "bg-emerald-500/10 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20"}`}
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
    </div>
  );
}
