"use client";

import type { BuyQueueItem } from "@/lib/state/useBuyQueue";

type BuyQueuePanelProps = {
  items: BuyQueueItem[];
  onRemove: (id: string) => void;
};

export default function BuyQueuePanel({ items, onRemove }: BuyQueuePanelProps) {
  return (
    <details className="rounded-lg border border-slate-700/80 bg-slate-900/50 px-4 py-3 text-xs text-slate-400">
      <summary className="cursor-pointer list-none font-semibold text-slate-200">
        あとで買う ({items.length})
      </summary>

      <div className="mt-3 space-y-2.5">
        {items.length === 0 ? (
          <p>解析後に、持っていない曲をここに追加できます。</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 rounded-md border border-slate-800 bg-slate-950/50 p-3.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-100">
                  {item.title}
                </div>
                <div className="truncate text-slate-300">
                  {item.artist}
                  {item.album ? ` · ${item.album}` : ""}
                </div>
                <div className="text-[11px] text-slate-500">
                  {item.buyStore}
                  {item.isrc ? ` · ${item.isrc}` : ""}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1.5">
                <a
                  href={item.buyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1.5 font-medium text-emerald-100 hover:bg-emerald-500/25"
                >
                  ストアで見る
                </a>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="rounded-md border border-slate-700/70 bg-transparent px-2.5 py-1.5 text-slate-400 hover:border-slate-600 hover:bg-slate-800/50 hover:text-slate-200"
                >
                  削除
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </details>
  );
}
