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
  onClear,
  onUndoRemove,
  removedCount = 0,
  storageWarning,
  onRetrySave,
  showHeading = true,
}: {
  items: QuietBuyLaterItem[];
  onRemove: (id: string) => void;
  onClear?: () => void;
  onUndoRemove?: () => void;
  removedCount?: number;
  storageWarning?: string | null;
  onRetrySave?: () => void;
  showHeading?: boolean;
}) {
  const { t: tr } = useI18n();
  if (items.length === 0 && !storageWarning && !removedCount) return null;
  return (
    <section className="text-sm text-secondary">
      {showHeading && (
        <h2 className="text-lg font-semibold text-foreground">
          {tr("Buy Later")}
        </h2>
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
      {removedCount > 0 && (
        <div
          role="status"
          className="mb-4 flex flex-wrap items-center gap-3 rounded border border-white/15 p-3"
        >
          <span>{tr("Removed {count} tracks", { count: removedCount })}</span>
          <button
            type="button"
            onClick={onUndoRemove}
            className="ps-action-secondary"
          >
            {tr("Undo")}
          </button>
        </div>
      )}
      {items.length > 0 && (
        <>
          <p className="mb-2 text-xs leading-5 text-muted">
            {tr(
              "Most recent additions first. Tracks added together keep their playlist order.",
            )}
          </p>
          <p className="mb-4 text-xs leading-5 text-muted">
            {tr(
              "Beatport links are affiliate links. Availability and the exact version are not verified.",
            )}
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
                    className="ps-action-secondary ml-auto"
                  >
                    {tr("Remove")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <details className="mt-5 border-t border-white/10 pt-4 text-xs text-muted">
            <summary className="cursor-pointer">
              {tr("Manage saved tracks")}
            </summary>
            <button
              type="button"
              onClick={() =>
                onClear ? onClear() : items.forEach((item) => onRemove(item.id))
              }
              className="mt-2 min-h-10 text-secondary hover:text-foreground"
            >
              {tr("Clear")}
            </button>
          </details>
        </>
      )}
    </section>
  );
}
