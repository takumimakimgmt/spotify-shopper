'use client';

import React from 'react';
import { ResultState } from '@/lib/types';

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
  const showPerf = process.env.NEXT_PUBLIC_SHOW_PERF === '1';

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="bg-slate-900/50 rounded px-2 py-1">
          <div className="text-slate-400 text-xs">Total</div>
          <div className="text-lg font-semibold text-slate-100">{total}</div>
        </div>
        <div className="bg-orange-900/20 rounded px-2 py-1">
          <div className="text-orange-300 text-xs">To buy</div>
          <div className="text-lg font-semibold text-orange-200">{toBuyCount}</div>
        </div>
        <div className="bg-emerald-900/20 rounded px-2 py-1">
          <div className="text-emerald-300 text-xs">Owned</div>
          <div className="text-lg font-semibold text-emerald-200">{ownedCount}</div>
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
    </div>
  );
}
