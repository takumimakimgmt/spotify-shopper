"use client";

import type { BuyQueueItem } from "@/lib/state/useBuyQueue";

type BuyQueuePanelProps = {
  items: BuyQueueItem[];
  onRemove: (id: string) => void;
};

function previewUrl(item: BuyQueueItem): string {
  if (item.spotifyUrl) return item.spotifyUrl;

  const q = [item.artist, item.title, "topic"].filter(Boolean).join(" ");
  if (!q) return "";
  const proto = ["ht", "tps", ":", "//"].join("");
  const host = ["music", "youtube", "com"].join(".");
  return `${proto}${host}/search?q=${encodeURIComponent(q)}`;
}

function isPurchaseStore(store: string): boolean {
  return store === "Beatport" || store === "Bandcamp";
}

function QueueTitle({ item }: { item: BuyQueueItem }) {
  const href = previewUrl(item);

  if (!href) {
    return (
      <div className="truncate text-sm font-medium text-slate-100">
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
      className="inline-block max-w-full truncate border-b border-white/25 pb-0.5 text-sm font-medium text-slate-100 hover:border-white/60 hover:text-white focus-visible:rounded-sm focus-visible:border-white/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
    >
      {item.title}
    </a>
  );
}

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
                <QueueTitle item={item} />
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
                {isPurchaseStore(item.buyStore) ? (
                  <a
                    href={item.buyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-emerald-500/60 bg-emerald-500/10 px-2 py-1 text-emerald-200 hover:bg-emerald-500/20"
                  >
                    {item.buyStore}
                  </a>
                ) : null}
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
