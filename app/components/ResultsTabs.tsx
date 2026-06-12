import React from "react";
import type { ResultState } from "../../lib/types";

interface ResultsTabsProps {
  multiResults: Array<[string, ResultState]>;
  activeTab: string | null;
  onSelectTab: (url: string) => void;
  onRemoveTab: (url: string) => void;
  onClearAll?: () => void;
}

export function ResultsTabs({
  multiResults,
  activeTab,
  onSelectTab,
  onRemoveTab,
  onClearAll: _onClearAll,
}: ResultsTabsProps) {
  // タブはtracks未定義でも必ず表示。UIで「未解析」表示はtracks未定義または空の場合。
  if (multiResults.length === 0) return null;

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 flex-wrap gap-2 overflow-x-hidden">
        {multiResults.map(([url, result]) => {
          const isActive = activeTab === url;
          const isUnparsed = !result.tracks || result.tracks.length === 0;
          return (
            <div
              key={url}
              className={`flex min-w-0 max-w-full items-center overflow-hidden rounded-md border text-sm font-medium transition sm:max-w-[18rem] ${
                isActive
                  ? "border-white/15 bg-white/[0.04] text-slate-100"
                  : "border-white/10 bg-transparent text-slate-500 hover:border-white/15 hover:text-slate-300"
              }`}
            >
              <button
                onClick={() => onSelectTab(url)}
                className="flex min-w-0 items-center gap-2 px-2.5 py-1.5 text-left"
                title={result.title}
              >
                <span className="min-w-0 truncate">{result.title}</span>
                <span
                  className={`shrink-0 tabular-nums ${
                    isActive ? "text-slate-300" : "text-slate-600"
                  }`}
                >
                  {result.total}
                </span>
                {result.hasRekordboxData && (
                  <span className="shrink-0 rounded border border-emerald-400/20 px-1 py-0.5 text-[10px] leading-none text-emerald-300/80">
                    XML
                  </span>
                )}
                {isUnparsed && (
                  <span className="shrink-0 text-xs text-yellow-300/80">
                    Not analyzed
                  </span>
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveTab(url);
                }}
                className="self-stretch border-l border-white/10 px-2 text-lg leading-none text-slate-500 transition hover:bg-rose-950/30 hover:text-rose-300"
                title="Remove this playlist"
                aria-label={`Remove ${result.title}`}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
