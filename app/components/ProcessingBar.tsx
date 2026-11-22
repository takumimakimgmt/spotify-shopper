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
    phaseLabel ?? (analyzing ? "Analyzing playlist..." : "Matching rekordbox");
  const pct = Math.min(
    100,
    Math.max(0, Number.isFinite(progress) ? progress : 0),
  );
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-secondary">
        <span role="status" aria-live="polite">
          {tr(label)}
        </span>
        <span>
          {isFetchingSpotify ? tr("Working...") : `${Math.round(pct)}%`}
        </span>
      </div>
      {isFetchingSpotify ? (
        <div className="text-xs text-muted">
          {tr("First run can take a few seconds while the server wakes up.")}
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-label={tr(label)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={isFetchingSpotify ? undefined : Math.round(pct)}
        aria-valuetext={isFetchingSpotify ? tr("Working...") : undefined}
        className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-700"
      >
        {isFetchingSpotify ? (
          <div className="h-full w-full animate-pulse rounded-full bg-accent/60 motion-reduce:animate-none" />
        ) : (
          <div
            className="h-full bg-accent rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  );
}
