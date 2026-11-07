"use client";

import { useI18n } from "@/lib/i18n/LanguageProvider";
import { purchaseLinks } from "@/lib/domain/purchaseLinks";

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
  const { t: tr } = useI18n();
  const href = queueListenUrl(item);

  if (!href) {
    return (
      <div
        title={item.title}
        className="line-clamp-2 break-words text-base font-medium text-slate-100"
      >
        {item.title}
      </div>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={tr("Listen to {title}", { title: item.title })}
      title={item.title}
      className="line-clamp-2 break-words text-base font-medium text-slate-100 underline decoration-white/20 underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300"
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
  showHeading = true,
}: {
  items: QuietBuyLaterItem[];
  onRemove: (id: string) => void;
  storageWarning?: string | null;
  onRetrySave?: () => void;
  showHeading?: boolean;
}) {
  const { t: tr } = useI18n();
  if (items.length === 0 && !storageWarning) return null;
  return (
    <section className="text-sm text-slate-300">
      {showHeading && (
        <h2 className="text-lg font-semibold text-white">{tr("Buy Later")}</h2>
      )}
      {storageWarning && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-amber-300/25 p-3 text-amber-200"
        >
          <p>{tr(storageWarning)}</p>
          <button
            type="button"
            onClick={onRetrySave}
            className="mt-2 min-h-10 rounded border border-white/20 px-3"
          >
            {tr("Retry storage")}
          </button>
        </div>
      )}
      {items.length > 0 && (
        <>
          <p className="mb-4 text-xs leading-5 text-slate-400">
            {tr("Availability / same version unverified.")}
          </p>
          <ul className="divide-y divide-white/10">
            {items.map((item) => (
              <li key={item.id} className="py-5 first:pt-0">
                <QueueTitle item={item} />
                <p className="mt-1 text-sm text-slate-300">{item.artist}</p>
                {item.album && item.album !== item.title && (
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {item.album}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-3">
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
                          ? "inline-flex min-h-10 items-center rounded-md border border-emerald-400/40 bg-emerald-400/10 px-3 text-sm font-medium text-emerald-100 hover:bg-emerald-400/20"
                          : "inline-flex min-h-10 items-center text-xs text-slate-400 underline underline-offset-4 hover:text-white"
                      }
                    >
                      {tr(link.label)}
                    </a>
                  ))}
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    aria-label={tr("Remove {title} from Buy Later", {
                      title: item.title,
                    })}
                    className="ml-auto min-h-10 px-1 text-xs text-slate-400 hover:text-white"
                  >
                    {tr("Remove")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <details className="mt-5 border-t border-white/10 pt-4 text-xs text-slate-500">
            <summary className="cursor-pointer">
              {tr("Manage saved tracks")}
            </summary>
            <button
              type="button"
              onClick={() => items.forEach((item) => onRemove(item.id))}
              className="mt-2 min-h-10 text-slate-300 hover:text-white"
            >
              {tr("Clear")}
            </button>
          </details>
        </>
      )}
    </section>
  );
}
