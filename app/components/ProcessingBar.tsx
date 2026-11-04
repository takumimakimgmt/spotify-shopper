"use client";

import { useI18n } from "@/lib/i18n/LanguageProvider";
import React from "react";

export interface ProcessingBarProps {
  analyzing: boolean;
  reanalyzing: boolean;
  progress: number;
  phaseLabel?: string | null;
}

export default function ProcessingBar({
  analyzing,
  reanalyzing,
  progress,
  phaseLabel,
}: ProcessingBarProps) {
  const { t: tr } = useI18n();

  if (!analyzing && !reanalyzing) return null;
  const isFetchingSpotify = phaseLabel === "Fetching Spotify...";
  const label =
    phaseLabel ?? (analyzing ? "Analyzing playlist..." : "Matching Rekordbox");
  const pct = Math.max(progress, 5);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-300">
        <span>{tr(label)}</span>
        <span>
          {isFetchingSpotify ? tr("Working...") : `${Math.round(pct)}%`}
        </span>
      </div>
      {isFetchingSpotify ? (
        <div className="text-xs text-slate-500">
          {tr("First run can take a few seconds while the server wakes up.")}
        </div>
      ) : null}
      <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
        {isFetchingSpotify ? (
          <div className="h-full w-full animate-pulse rounded-full bg-gradient-to-r from-emerald-500/30 via-emerald-300 to-emerald-500/30" />
        ) : (
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  );
}
