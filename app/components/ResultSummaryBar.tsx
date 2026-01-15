"use client";

import React, { useState } from "react";
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
  const [debugOpen, setDebugOpen] = useState(false);

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

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="bg-slate-900/50 rounded px-2 py-1">
          <div className="text-slate-400 text-xs">All</div>
          <div className="text-lg font-semibold text-slate-100">{total}</div>
        </div>
        <div className="bg-orange-900/20 rounded px-2 py-1">
          <div className="text-orange-300 text-xs">To buy</div>
          <div className="text-lg font-semibold text-orange-200">
            {toBuyCount}
          </div>
        </div>
        <div className="bg-emerald-900/20 rounded px-2 py-1">
          <div className="text-emerald-300 text-xs">Owned</div>
          <div className="text-lg font-semibold text-emerald-200">
            {ownedCount}
          </div>
        </div>
      </div>

      {/* Badge row: cache_hit, refresh */}
      {showPerf && (
        <div className="flex flex-wrap gap-2 items-center">
          {cacheHit && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2.5 py-1 text-xs text-blue-300">
              Cached
            </span>
          )}
          {refreshUsed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-1 text-xs text-amber-300">
              Reloaded
            </span>
          )}
        </div>
      )}

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

      {/* Debug toggle */}
      {hasDebugInfo && (
        <div className="mt-2">
          <button
            onClick={() => setDebugOpen(!debugOpen)}
            className="text-[11px] text-slate-400 hover:text-slate-300 underline"
          >
            {debugOpen ? "Hide" : "Show"} debug details
          </button>
          {debugOpen && (
            <details open className="mt-2">
              <summary className="text-[10px] text-slate-500 cursor-pointer">
                Meta info
              </summary>
              <pre className="bg-slate-950 border border-slate-700 rounded p-2 mt-1 text-[9px] text-slate-300 overflow-auto max-h-48 whitespace-pre-wrap break-words">
                {debugInfo}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
