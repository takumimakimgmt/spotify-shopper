"use client";

import type { BuyQueueItem } from "@/lib/state/useBuyQueue";

type BuyQueuePanelProps = {
  items: BuyQueueItem[];
  onRemove: (id: string) => void;
};

export default function BuyQueuePanel({ items, onRemove }: BuyQueuePanelProps) {
  return (
    <details className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3 text-xs text-slate-400">
      <summary className="cursor-pointer list-none font-medium text-slate-300">
        Buy Later ({items.length})
      </summary>

      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <p>Save not-owned tracks here after analysis.</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-2 rounded-md border border-slate-800 bg-slate-950/50 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-100">
                  {item.title}
                </div>
                <div className="truncate text-slate-400">
                  {item.artist}
                  {item.album ? ` · ${item.album}` : ""}
                </div>
                <div className="text-[11px] text-slate-500">
                  {item.buyStore}
                  {item.isrc ? ` · ${item.isrc}` : ""}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <a
                  href={item.buyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-emerald-500/60 bg-emerald-500/10 px-2 py-1 text-emerald-200 hover:bg-emerald-500/20"
                >
                  Open store
                </a>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="rounded-md border border-slate-700 px-2 py-1 text-slate-300 hover:text-white"
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </details>
  );
}
