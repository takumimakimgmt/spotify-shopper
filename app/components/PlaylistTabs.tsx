import React from 'react';
import type { ResultState } from '../../lib/types';

export type PlaylistTabsProps = {
  multiResults: Array<[string, ResultState]>;
  activeTab: string | null;
  setActiveTab: (tab: string | null) => void;
  onRemoveTab: (tab: string) => void;
  onClearAll: () => void;
};

export function PlaylistTabs({ multiResults, activeTab, setActiveTab, onRemoveTab, onClearAll }: PlaylistTabsProps) {
  if (multiResults.length === 0) return null;

  return (
    <div className="flex items-center gap-3 pb-2 border-b border-slate-800">
      <div className="flex gap-2 overflow-x-auto flex-1">
        {multiResults.map(([url, result]) => {
          const isActive = activeTab === url;
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
                onClick={() => setActiveTab(url)}
                className="text-left min-w-0 flex items-center gap-1.5"
              >
                <span>
                  {result.title} ({result.total})
                </span>
                {result.hasRekordboxData && (
                  <span
                    className="text-[10px] px-1 py-0.5 bg-emerald-600/30 text-emerald-300 rounded"
                    title="Analyzed with Rekordbox XML"
                  >
                    XML✓
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
      <button
        onClick={onClearAll}
        className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition whitespace-nowrap"
        title="Clear all playlists"
      >
        Clear All
      </button>
    </div>
  );
}
