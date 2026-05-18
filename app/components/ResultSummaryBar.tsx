"use client";

import React from "react";
import { ResultState } from "@/lib/types";

export interface ResultSummaryBarProps {
  result: ResultState | null;
  ownedCount: number;
  toBuyCount: number;
}

export default function ResultSummaryBar({
  result,
  ownedCount,
  toBuyCount,
}: ResultSummaryBarProps) {
  if (!result) return null;

  const total = result.total;
  const cacheHit = result.meta?.cache_hit ?? false;
  const refreshUsed = result.meta?.refresh ?? false;
  const showPerf = process.env.NEXT_PUBLIC_SHOW_PERF === "1";
  const totalMs = result.meta?.client_total_ms;
  const apiMs = result.meta?.client_api_ms;
  const mapMs = result.meta?.client_map_ms;
  const overheadMs = result.meta?.client_overhead_ms;
  const rbMetrics = result.meta?.rekordbox;

  // Prepare debug info
  const debugInfo = result.meta ? JSON.stringify(result.meta, null, 2) : "";
  const hasDebugInfo = debugInfo.length > 0;
  const buyRate = total > 0 ? Math.round((toBuyCount / total) * 100) : 0;
  const ownedRate = total > 0 ? Math.round((ownedCount / total) * 100) : 0;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4 space-y-4">
      <div className="grid gap-3 lg:grid-cols-[1.4fr_repeat(2,minmax(0,1fr))]">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-amber-200/80">
            To buy
          </div>
          <div className="mt-2 flex items-end gap-3">
            <div className="text-4xl font-semibold leading-none text-amber-100">
              {toBuyCount}
            </div>
            <div className="pb-1 text-sm text-amber-200/80">
              {buyRate}% of this playlist still needs buying
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
            All tracks
          </div>
          <div className="mt-3 text-2xl font-semibold text-slate-100">
            {total}
          </div>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-200/80">
            Owned
          </div>
          <div className="mt-2 flex items-end gap-3">
            <div className="text-2xl font-semibold text-emerald-100">
              {ownedCount}
            </div>
            <div className="pb-0.5 text-sm text-emerald-200/70">
              {ownedRate}% covered
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-100">
          Buying workflow focus
        </span>
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

      {totalMs !== undefined && (
        <div className="text-[11px] text-slate-400">
          Finished in {(totalMs / 1000).toFixed(2)}s
          {apiMs !== undefined ? ` • API ${(apiMs / 1000).toFixed(2)}s` : ""}
          {mapMs !== undefined ? ` • Map ${mapMs.toFixed(0)}ms` : ""}
          {overheadMs !== undefined
            ? ` • Overhead ${overheadMs.toFixed(0)}ms`
            : ""}
        </div>
      )}

      {rbMetrics && (
        <div className="text-[11px] text-slate-500">
          Rekordbox: {rbMetrics.track_total ?? "-"} tracks • fuzzy{" "}
          {rbMetrics.fuzzy_count ?? 0} • {rbMetrics.match_ms ?? "-"}ms
        </div>
      )}

      {hasDebugInfo && (
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
