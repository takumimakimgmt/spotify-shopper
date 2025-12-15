'use client';

import React, { useRef, useState } from 'react';
import { usePlaylistAnalyzer } from '@/lib/state/usePlaylistAnalyzer';
import ProcessingBar from './ProcessingBar';

export interface AnalyzeFormProps {
  analyzer: ReturnType<typeof usePlaylistAnalyzer>;
}

export default function AnalyzeForm({ analyzer }: AnalyzeFormProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const rekordboxInputRef = useRef<HTMLInputElement>(null);

  const handleRekordboxClick = () => {
    rekordboxInputRef.current?.click();
  };

  return (
    <section className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-4">
      <form onSubmit={analyzer.handleAnalyze} className="space-y-4">
        {/* Processing indicator */}
        <ProcessingBar
          analyzing={analyzer.loading}
          reanalyzing={analyzer.isReanalyzing}
          progress={analyzer.progress}
        />

        {/* Playlist URLs input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Playlist URLs</label>
          <textarea
            value={analyzer.playlistUrlInput}
            onChange={(e) => analyzer.setPlaylistUrlInput(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono"
            placeholder="https://open.spotify.com/playlist/...&#10;https://music.apple.com/...&#10;3KCXw0N4EJmHIg0KiKjNSM"
            rows={4}
          />
          <p className="text-xs text-slate-400">
            Full URL or playlist ID. Multiple playlists will be analyzed in parallel and results shown in tabs.
          </p>
        </div>

        {/* Rekordbox XML upload */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Rekordbox Collection XML (optional)</label>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <input
              ref={rekordboxInputRef}
              id="rekordbox-file-input"
              type="file"
              accept=".xml"
              onChange={analyzer.handleRekordboxChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={handleRekordboxClick}
              disabled={analyzer.isReanalyzing}
              className={`inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold ${
                analyzer.isReanalyzing
                  ? 'bg-slate-700 text-slate-300 pointer-events-none'
                  : 'bg-emerald-500 text-slate-900 hover:bg-emerald-400 cursor-pointer'
              }`}
            >
              Choose File
            </button>
            <span className="text-xs text-slate-400">
              Upload your Rekordbox collection XML to mark Owned / Not owned.
            </span>
          </div>
        </div>

        {/* Form controls: Unowned toggle + Analyze button */}
        <div className="flex items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={analyzer.onlyUnowned}
              onChange={(e) => analyzer.setOnlyUnowned(e.target.checked)}
              className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-emerald-500"
            />
            <span>Show only unowned tracks</span>
          </label>

          {/* Analyze button with Force Refresh dropdown */}
          <div className="relative">
            <button
              type="submit"
              disabled={analyzer.isProcessing}
              onClick={(e) => {
                // Capture shift for backward compatibility
                if (e.shiftKey) {
                  analyzer.setForceRefreshHint(true);
                }
              }}
              className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-black hover:bg-emerald-400 disabled:opacity-60"
            >
              {analyzer.isProcessing ? (
                <>
                  <div className="inline-block h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-r-transparent" />
                  {analyzer.isReanalyzing ? 'Re-analyzing…' : 'Analyzing…'}
                </>
              ) : (
                'Analyze'
              )}
            </button>

            {/* Dropdown for Force Refresh */}
            <button
              type="button"
              disabled={analyzer.isProcessing}
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="ml-1 inline-flex items-center justify-center rounded-md bg-emerald-500 px-2 py-2 text-xs text-black hover:bg-emerald-400 disabled:opacity-60"
            >
              ▼
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-md shadow-lg z-50">
                <button
                  type="button"
                  onClick={() => {
                    analyzer.setForceRefreshHint(false);
                    analyzer.handleAnalyze({ preventDefault: () => {} } as any);
                    setDropdownOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
                >
                  Analyze (use cache)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    analyzer.setForceRefreshHint(true);
                    analyzer.handleAnalyze({ preventDefault: () => {} } as any);
                    setDropdownOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 border-t border-slate-700"
                >
                  Force refresh
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Error display */}
        {analyzer.errorText && (
          <div className="mt-3 p-3 rounded-lg bg-red-900/20 border border-red-700/50 text-red-200 text-xs whitespace-pre-wrap font-mono">
            {analyzer.errorText}
          </div>
        )}

        {/* Apple Music notice */}
        {analyzer.appleNotice && (
          <div className="mt-3 p-2 rounded-lg bg-amber-900/20 border border-amber-700/50 text-amber-200 text-xs">
            ⚠️ Apple Music playlists require browser-based fetching (Playwright). This may take longer.
          </div>
        )}
      </form>
    </section>
  );
}
