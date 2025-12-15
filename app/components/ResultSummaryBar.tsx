'use client';

import React from 'react';
import { usePlaylistAnalyzer } from '@/lib/state/usePlaylistAnalyzer';

export interface ResultSummaryBarProps {
  analyzer: ReturnType<typeof usePlaylistAnalyzer>;
}

export default function ResultSummaryBar({ analyzer }: ResultSummaryBarProps) {
  if (!analyzer.currentResult) {
    return null;
  }

  const total = analyzer.currentResult.total;
  const owned = analyzer.ownedCount;
  const checkout = analyzer.checkoutCount;
  const percentage = total > 0 ? ((owned / total) * 100).toFixed(0) : 0;

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3">
      {/* Status badges */}
      <div className="flex gap-2 flex-wrap">
        {analyzer.currentResult.meta?.cache_hit && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 border border-blue-500/30 px-2 py-1 text-xs text-blue-300">
            💾 Cache used
          </span>
        )}
        {analyzer.currentResult.meta?.refresh === 1 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-500/30 px-2 py-1 text-xs text-amber-300">
            🔄 Forced refresh
          </span>
        )}
        {analyzer.forceRefreshHint && (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-500/20 border border-green-500/30 px-2 py-1 text-xs text-green-300">
            ✓ Force refresh pending
          </span>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="space-y-1">
          <div className="text-xs text-slate-400">Total</div>
          <div className="text-lg font-semibold text-slate-100">{total}</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-slate-400">Owned</div>
          <div className="text-lg font-semibold text-emerald-400">{owned}</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-slate-400">To Buy</div>
          <div className="text-lg font-semibold text-amber-400">{checkout}</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-slate-400">Coverage</div>
          <div className="text-lg font-semibold text-blue-400">{percentage}%</div>
        </div>
      </div>

      {/* Performance info */}
      {analyzer.currentResult.meta && (
        <div className="text-xs text-slate-500 space-y-1">
          <div>
            Fetch: {analyzer.currentResult.meta.fetch_ms?.toFixed(0) || 0}ms |
            API: {analyzer.currentResult.meta.total_api_ms?.toFixed(1) || 0}ms
          </div>
        </div>
      )}
    </div>
  );
}
