"use client";

import { useI18n } from "@/lib/i18n/LanguageProvider";
import React from "react";
import { ResultState } from "@/lib/types";

export interface ResultSummaryBarProps {
  result: ResultState | null;
  ownedCount: number;
  toBuyCount: number;
  unknownCount: number;
}

export default function ResultSummaryBar({
  result,
  ownedCount,
  toBuyCount,
  unknownCount,
}: ResultSummaryBarProps) {
  const { t: tr } = useI18n();

  if (!result) return null;

  const total = result.total;
  const cacheHit = result.meta?.cache_hit ?? false;
  const refreshUsed = result.meta?.refresh ?? false;
  const showPerf = process.env.NEXT_PUBLIC_SHOW_PERF === "1";

  // Prepare debug info
  const debugInfo = result.meta ? JSON.stringify(result.meta, null, 2) : "";
  const hasDebugInfo = debugInfo.length > 0;

  return (
    <div className="space-y-1 text-sm text-slate-300">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          [tr("Tracks"), total],
          [tr("Not in XML"), toBuyCount],
          [tr("Matched / confirmed"), ownedCount],
          [tr("Needs review"), unknownCount],
        ].map(([label, count]) => (
          <div
            key={label}
            className="rounded-lg border border-white/10 bg-white/[0.025] px-4 py-3"
          >
            <dt className="text-xs text-slate-400">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-white">
              {count}
            </dd>
          </div>
        ))}
      </dl>
      <p className="py-2 text-sm text-slate-300">
        {tr(
          result.hasRekordboxData
            ? "Not in XML means absent from this export. Check your library before buying."
            : "Add your rekordbox XML to check which tracks you already have.",
        )}
      </p>
      <details className="text-sm text-slate-400">
        <summary className="cursor-pointer py-1 hover:text-slate-200">
          {tr("About these results")}
        </summary>
        <div className="space-y-3 py-3">
          {result.tracks?.some((t) => t.reviewDecision) && (
            <p>
              {tr(
                "Counts include your saved confirmations. Automatic XML evidence remains available in matching details.",
              )}
            </p>
          )}
          {result.meta?.match_engine === "browser-v1" && (
            <p>
              {tr(
                "Library matching completed on this device. XML and library metadata were not uploaded.",
              )}
            </p>
          )}
          {result.changeSummary?.hasPrevious && (
            <p>
              {tr("Since the last check: ")}
              {result.changeSummary.added}
              {tr(" added ·")} {result.changeSummary.changed}
              {tr(" changed ·")} {result.changeSummary.rechecked}
              {tr(" rechecked ·")} {result.changeSummary.removed}
              {tr(" removed ·")} {result.changeSummary.unchanged}
              {tr(" unchanged")}
            </p>
          )}
          {result.hasRekordboxData && (
            <div className="space-y-1">
              <p className="rounded-lg border border-amber-300/20 bg-amber-300/5 p-3 leading-6 text-amber-100">
                {tr(
                  "Not in your XML means no match in this export, not proof that you do not own the track. Tracks added after export and streaming-only tracks may be absent.",
                )}
              </p>
              <details>
                <summary className="cursor-pointer">
                  {tr("XML checked")}
                </summary>
                <p className="break-words">
                  {result.rekordboxMeta?.filename || tr("Selected XML")}
                </p>
                {result.meta?.rekordbox?.library_track_count != null && (
                  <p>
                    {result.meta.rekordbox.library_track_count}
                    {tr(" library entries checked")}
                  </p>
                )}
                {result.meta?.rekordbox?.matched_at && (
                  <p>
                    {tr("Checked: ")}
                    {result.meta.rekordbox.matched_at}
                  </p>
                )}
                {result.meta?.rekordbox?.library_sha256 && (
                  <p className="break-all">
                    {tr("Compared metadata fingerprint:")}{" "}
                    {result.meta.rekordbox.library_sha256}
                  </p>
                )}
              </details>
            </div>
          )}
          {(result.meta?.skipped_track_count ?? 0) > 0 && (
            <p className="text-amber-200" role="status">
              {result.meta?.source_track_count ?? total}
              {tr(" playlist entries · ")}
              {total} {tr("analyzed · ")}
              {result.meta?.skipped_track_count}
              {tr(" skipped (local or unavailable tracks).")}
            </p>
          )}
          {unknownCount > 0 && (
            <p className="text-amber-200">
              {tr(
                "Tracks that need review or have not been checked are excluded from Not in XML. Check matching details, or upload XML if you have not checked your library yet.",
              )}
            </p>
          )}
        </div>
      </details>
      <div className="flex flex-wrap items-center gap-2">
        {showPerf && cacheHit && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2.5 py-1 text-xs text-blue-300">
            {tr("Cached")}
          </span>
        )}
        {showPerf && refreshUsed && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-1 text-xs text-amber-300">
            {tr("Reloaded")}
          </span>
        )}
      </div>

      {showPerf && hasDebugInfo && (
        <details className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
          <summary className="cursor-pointer text-[11px] text-slate-400">
            {tr("Debug details")}
          </summary>
          <pre className="mt-2 overflow-auto max-h-48 whitespace-pre-wrap break-words rounded border border-slate-700 bg-slate-950 p-2 text-[9px] text-slate-300">
            {debugInfo}
          </pre>
        </details>
      )}
    </div>
  );
}
