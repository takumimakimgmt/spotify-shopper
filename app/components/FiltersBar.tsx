import React from "react";
import type { SortKey } from "../../lib/types";

interface FiltersBarProps {
  categoryFilter: "all" | "toBuy" | "owned";
  setCategoryFilter: (value: "all" | "toBuy" | "owned") => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  sortKey: SortKey;
  setSortKey: (value: SortKey) => void;
}

export function FiltersBar({
  categoryFilter,
  setCategoryFilter,
  searchQuery,
  setSearchQuery,
  sortKey,
  setSortKey,
}: FiltersBarProps) {
  return (
    <div className="space-y-3">
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
