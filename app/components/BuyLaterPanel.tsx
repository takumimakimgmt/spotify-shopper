"use client";

import { purchaseLinks } from "@/lib/domain/purchaseLinks";
import { downloadPurchases } from "@/lib/domain/portablePurchases";

type QuietBuyLaterItem = {
  id: string;
  title: string;
  artist: string;
  album?: string;
  isrc?: string;
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

export default function BuyLaterPanel({
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

      {items.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            className="min-h-11 rounded border border-white/20 px-3 py-2 text-slate-100"
            onClick={() =>
              downloadPurchases(
                items.map((item) => ({
                  ...item,
                  status: "Saved candidate · ownership not rechecked",
                  stores:
                    item.buyStore === "Beatport"
                      ? { beatport: item.buyUrl }
                      : { bandcamp: item.buyUrl },
                })),
              )
            }
          >
            Download saved candidates for phone
          </button>
          <p className="mt-2 text-xs">
            Send the downloaded HTML file to your phone and open in a browser.
            Includes song details and store links, without XML.
          </p>
        </div>
      )}
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
                {purchaseLinks({
                  ...item,
                  stores:
                    item.buyStore === "Beatport"
                      ? { beatport: item.buyUrl }
                      : { bandcamp: item.buyUrl },
                }).map((link) => (
                  <a
                    key={link.name}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className={
                      link.name === "Beatport"
                        ? "min-h-11 rounded border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-emerald-100"
                        : "min-h-11 px-2 py-2 text-xs underline"
                    }
                  >
                    {link.label}
                  </a>
                ))}
                <p className="w-full text-xs">
                  Availability / same version unverified.
                </p>
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
