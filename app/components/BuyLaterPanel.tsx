"use client";

import { useI18n } from "@/lib/i18n/LanguageProvider";
import { TrackIdentity, TrackStoreLinks } from "./TrackPresentation";

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
              <li key={item.id} className="py-3 first:pt-0">
                <TrackIdentity track={item} />
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <TrackStoreLinks
                    track={{
                      ...item,
                      stores:
                        item.buyStore === "Beatport"
                          ? { beatport: item.buyUrl }
                          : { bandcamp: item.buyUrl },
                    }}
                  />
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
