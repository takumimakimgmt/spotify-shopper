'use client';

import React from 'react';

export interface ProcessingBarProps {
  analyzing: boolean;
  reanalyzing: boolean;
  progress: number;
}

export default function ProcessingBar({ analyzing, reanalyzing, progress }: ProcessingBarProps) {
  if (!analyzing && !reanalyzing) return null;
  const label = analyzing ? 'Analyzing playlist…' : 'Matching with Rekordbox XML';
  const pct = Math.max(progress, 5);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-300">
        <span>{label}</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
