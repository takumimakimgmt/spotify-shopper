import React from 'react';
import type { ResultState } from '../../lib/types';

interface ResultsTabsProps {
  multiResults: Array<[string, ResultState]>;
  activeTab: string | null;
  onSelectTab: (url: string) => void;
  onRemoveTab: (url: string) => void;
  onClearAll: () => void;
}

export function ResultsTabs({ multiResults, activeTab, onSelectTab, onRemoveTab, onClearAll }: ResultsTabsProps) {
  // タブはtracks未定義でも必ず表示。UIで「未解析」表示はtracks未定義または空の場合。
  if (multiResults.length === 0) return null;

  return (
    <div className="flex items-center gap-3 pb-2 border-b border-slate-800">
      <div className="flex gap-2 overflow-x-auto flex-1">
        {multiResults.map(([url, result]) => {
          const isActive = activeTab === url;
          const isUnparsed = !result.tracks || result.tracks.length === 0;
          return (
            <div
              key={url}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap rounded-t-lg transition ${
                isActive
                  ? 'bg-emerald-500/20 border-b-2 border-emerald-500 text-emerald-200'
                  : 'bg-slate-800/50 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <button
                onClick={() => onSelectTab(url)}
                className="text-left min-w-0 flex items-center gap-1.5"
              >
                <span>
                  {result.title} ({result.total})
                  {isUnparsed && (
                    <span className="ml-2 text-xs text-yellow-400">未解析</span>
                  )}
                </span>
                {result.hasRekordboxData && (
                  <span
                    className="text-[10px] px-1 py-0.5 bg-emerald-600/30 text-emerald-300 rounded"
                  >
                    XML
                  </span>
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveTab(url);
                }}
                className="text-slate-400 hover:text-red-400 transition text-lg leading-none flex-shrink-0"
                title="Remove this playlist"
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
