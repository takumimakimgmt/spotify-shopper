"use client";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { useMemo } from "react";
import type { PlaylistRow, ResultState } from "@/lib/types";
import { buildPurchasePlan } from "@/lib/domain/purchasePlan";
import { purchaseLinks } from "@/lib/domain/purchaseLinks";
import { getBuyQueueItemId } from "@/lib/state/useBuyQueue";

export default function PurchasePlan({
  results,
  queuedIds,
  onSave,
}: {
  results: Array<[string, ResultState]>;
  queuedIds: Set<string>;
  onSave: (track: PlaylistRow, link: { name: string; url: string }) => void;
}) {
  const { t: tr } = useI18n();

  const entries = useMemo(() => buildPurchasePlan(results), [results]);
  if (results.length < 2 || !entries.length) return null;
  return (
    <section className="space-y-3 rounded-lg border border-white/15 p-4 text-sm">
      <h2 className="font-semibold">{tr("Purchase plan across playlists")}</h2>
      <p className="text-slate-300">
        {tr(
          entries.length === 1
            ? "{count} unique recording not found in the selected exports. Check your library before buying. Versions are kept separate."
            : "{count} unique recordings not found in the selected exports. Check your library before buying. Versions are kept separate.",
          { count: entries.length },
        )}
      </p>
      <details>
        <summary className="cursor-pointer">
          {tr("Review combined candidates")}
        </summary>
        <ul className="mt-3 space-y-4">
          {entries.map((entry) => {
            const link = purchaseLinks(entry.track)[0];
            const url = link.url;
            const queued = queuedIds.has(getBuyQueueItemId(entry.track));
            return (
              <li key={entry.id} className="border-t border-white/10 pt-3">
                <p>
                  {entry.track.title} — {entry.track.artist}
                </p>
                <p className="text-slate-400">
                  {tr("Appears in ")}
                  {entry.playlists.length}
                  {tr(" playlists:")}{" "}
                  {entry.playlists.map((p) => p.title).join(", ")}
                </p>
                <p className="text-xs text-slate-400">
                  {tr(
                    "Search availability and product versions are unverified.",
                  )}
                </p>
                <div className="mt-2 flex gap-4">
                  <a href={url} target="_blank" rel="noreferrer">
                    {tr(link.label)}
                  </a>
                  <button
                    disabled={queued}
                    onClick={() =>
                      onSave(entry.track, { name: "Beatport", url })
                    }
                  >
                    {queued ? tr("Saved") : tr("Buy Later")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </details>
    </section>
  );
}
