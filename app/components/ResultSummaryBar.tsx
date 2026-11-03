"use client";

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
      <div>
        {total} tracks · {toBuyCount} not owned · {ownedCount} owned ·{" "}
        {unknownCount} unverified
      </div>
      {(result.meta?.skipped_track_count ?? 0) > 0 && (
        <p className="text-amber-200" role="status">
          {result.meta?.source_track_count ?? total} playlist entries · {total}{" "}
          analyzed · {result.meta?.skipped_track_count} skipped (local or
          unavailable tracks).
        </p>
      )}
      {unknownCount > 0 && (
        <p className="text-amber-200">
          Unverified tracks are excluded from To buy. Check matching details, or
          upload XML if you have not checked your library yet.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {showPerf && cacheHit && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2.5 py-1 text-xs text-blue-300">
            Cached
          </span>
        )}
        {showPerf && refreshUsed && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-1 text-xs text-amber-300">
            Reloaded
          </span>
        )}
      </div>

      {showPerf && hasDebugInfo && (
        <details className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
          <summary className="cursor-pointer text-[11px] text-slate-400">
            Debug details
          </summary>
          <pre className="mt-2 overflow-auto max-h-48 whitespace-pre-wrap break-words rounded border border-slate-700 bg-slate-950 p-2 text-[9px] text-slate-300">
            {debugInfo}
          </pre>
        </details>
      )}
    </div>
  );
}
