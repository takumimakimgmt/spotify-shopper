'use client';

import React from 'react';
import { ResultState } from '@/lib/types';

export interface ResultSummaryBarProps {
  result: ResultState | null;
  ownedCount: number;
  checkoutCount: number;
}

export default function ResultSummaryBar({
  result,
  ownedCount,
  checkoutCount,
}: ResultSummaryBarProps) {
  if (!result) return null;

  const total = result.total;
  const coverage = total > 0 ? ((ownedCount / total) * 100).toFixed(0) : 0;
  const cacheHit = result.meta?.cache_hit ?? false;
  const fetchMs = result.meta?.fetch_ms ?? null;
  const refreshUsed = result.meta?.refresh ?? false;

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 text-xs">
        <div className="bg-slate-900/50 rounded px-2 py-1">
          <div className="text-slate-400 text-xs">Total</div>
          <div className="text-lg font-semibold text-slate-100">{total}</div>
        </div>
        <div className="bg-emerald-900/20 rounded px-2 py-1">
          <div className="text-emerald-300 text-xs">Owned</div>
          <div className="text-lg font-semibold text-emerald-200">{ownedCount}</div>
        </div>
        <div className="bg-orange-900/20 rounded px-2 py-1">
          <div className="text-orange-300 text-xs">Checkout</div>
          <div className="text-lg font-semibold text-orange-200">{checkoutCount}</div>
        </div>
        <div className="bg-blue-900/20 rounded px-2 py-1">
          <div className="text-blue-300 text-xs">Coverage</div>
          <div className="text-lg font-semibold text-blue-200">{coverage}%</div>
        </div>
      </div>

      {/* Badge row: cache_hit, refresh, time */}
      <div className="flex flex-wrap gap-2 items-center">
        {cacheHit && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2.5 py-1 text-xs text-blue-300">
            💾 Cache used
          </span>
        )}
        {refreshUsed && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-1 text-xs text-amber-300">
            ✨ Fresh fetch
          </span>
        )}
        {fetchMs !== null && (
          <span className="text-xs text-slate-400">
            Fetched in {fetchMs}ms
          </span>
        )}
      </div>
    </div>
  );
}
