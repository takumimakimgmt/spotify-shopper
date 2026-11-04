"use client";
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
  const entries = useMemo(() => buildPurchasePlan(results), [results]);
  if (results.length < 2 || !entries.length) return null;
  return (
    <section className="space-y-3 rounded-lg border border-white/15 p-4 text-sm">
      <h2 className="font-semibold">Purchase plan across playlists</h2>
      <p className="text-slate-300">
        {entries.length} unique recording{entries.length === 1 ? "" : "s"} not
        found in the selected exports. Check your library before buying.
        Versions are kept separate.
      </p>
      <details>
        <summary className="cursor-pointer">Review combined candidates</summary>
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
                  Appears in {entry.playlists.length} playlists:{" "}
                  {entry.playlists.map((p) => p.title).join(", ")}
                </p>
                <p className="text-xs text-slate-400">
                  Search availability and product versions are unverified.
                </p>
                <div className="mt-2 flex gap-4">
                  <a href={url} target="_blank" rel="noreferrer">
                    {link.label}
                  </a>
                  <button
                    disabled={queued}
                    onClick={() =>
                      onSave(entry.track, { name: "Beatport", url })
                    }
                  >
                    {queued ? "Saved" : "Buy Later"}
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
