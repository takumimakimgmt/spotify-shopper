'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ProcessingBar from './ProcessingBar';
import { ProgressItem } from './ProgressList';

export interface AnalyzeFormProps {
  // State
  playlistUrlInput: string;
  rekordboxFile: File | null;
  onlyUnowned: boolean;
  loading: boolean;
  isReanalyzing: boolean;
  progress: number;
  errorText: string | null;
  appleNotice: boolean;
  progressItems: ProgressItem[];
  // Setters
  setPlaylistUrlInput: (value: string) => void;
  setRekordboxFile: (file: File | null) => void;
  setOnlyUnowned: (value: boolean) => void;
  // Handlers
  handleAnalyze: (e: React.FormEvent) => void;
  handleRekordboxChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setForceRefreshHint: (value: boolean) => void;
  cancelAnalyze?: () => void;
  retryFailed?: () => void;
}

export default function AnalyzeForm(props: AnalyzeFormProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const rekordboxInputRef = useRef<HTMLInputElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const handleRekordboxClick = () => {
    rekordboxInputRef.current?.click();
  };

  const isProcessing = props.loading || props.isReanalyzing;
  const hasFailed = useMemo(
    () => props.progressItems.some((p) => p.status === 'error'),
    [props.progressItems]
  );
  const isAppleInput = useMemo(
    () => props.playlistUrlInput.toLowerCase().includes('music.apple.com'),
    [props.playlistUrlInput]
  );

  useEffect(() => {
    if (props.errorText && errorSummaryRef.current) {
      errorSummaryRef.current.focus();
    }
  }, [props.errorText]);

  return (
    <section className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-4">
      <form onSubmit={props.handleAnalyze} className="space-y-4">
        {/* Processing indicator */}
        <ProcessingBar
          analyzing={props.loading}
          reanalyzing={props.isReanalyzing}
          progress={props.progress}
        />

        {/* Error summary (page-level) */}
        {props.errorText && (
          <div
            ref={errorSummaryRef}
            tabIndex={-1}
            className="rounded-md border border-red-500 bg-red-900/40 px-3 py-2 text-xs text-red-100"
            role="alert"
            aria-live="polite"
          >
            <p className="font-semibold">There was a problem</p>
            <a href="#playlist-urls" className="underline">
              {props.errorText}
            </a>
          </div>
        )}

        {/* Playlist URLs input */}
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="playlist-urls">Playlist URLs</label>
          {props.errorText && (
            <p className="text-xs text-red-200" id="playlist-urls-error">
              {props.errorText}
            </p>
          )}
          <textarea
            id="playlist-urls"
            value={props.playlistUrlInput}
            onChange={(e) => props.setPlaylistUrlInput(e.target.value)}
            className={`w-full rounded-md border ${props.errorText ? 'border-red-500' : 'border-slate-700'} bg-slate-950/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono`}
            placeholder="https://open.spotify.com/playlist...&#10;https://music.apple.com...&#10;3KCXw0N4EJmHIg0KiKjNSM"
            rows={4}
            aria-invalid={props.errorText ? 'true' : 'false'}
            aria-describedby={props.errorText ? 'playlist-urls-error' : undefined}
          />
          <p className="text-xs text-slate-400">
            Full URL or playlist ID. Multiple playlists will be analyzed in parallel and results shown in tabs.
          </p>
          {isAppleInput && (
            <p className="text-xs text-amber-200">
              Apple Music can take 30–60s to fetch. If it times out, press Analyze again with a single URL.
            </p>
          )}
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
              onChange={props.handleRekordboxChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={handleRekordboxClick}
              disabled={props.isReanalyzing}
              className={`inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold ${
                props.isReanalyzing
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
              checked={props.onlyUnowned}
              onChange={(e) => props.setOnlyUnowned(e.target.checked)}
              className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-emerald-500"
            />
            <span>Show only unowned tracks</span>
          </label>

          {/* Analyze button with Force Refresh dropdown */}
          <div className="relative flex gap-1 items-center">
            <button
              type="submit"
              disabled={isProcessing}
              className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-black hover:bg-emerald-400 disabled:opacity-60"
            >
              {isProcessing ? (
                <>
                  <div className="inline-block h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-r-transparent" />
                  {props.isReanalyzing ? 'Re-analyzing…' : 'Analyzing…'}
                </>
              ) : (
                'Analyze'
              )}
            </button>

            {isProcessing && props.cancelAnalyze && (
              <button
                type="button"
                onClick={props.cancelAnalyze}
                className="inline-flex items-center justify-center rounded-md bg-slate-700 px-3 py-2 text-xs font-medium text-white hover:bg-slate-600"
              >
                Cancel
              </button>
            )}

            {hasFailed && props.retryFailed && (
              <button
                type="button"
                onClick={props.retryFailed}
                className="inline-flex items-center justify-center rounded-md bg-slate-700 px-3 py-2 text-xs font-medium text-white hover:bg-slate-600"
              >
                Retry failed
              </button>
            )}

            {/* Force Refresh dropdown trigger */}
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="inline-flex items-center justify-center rounded-md bg-slate-700 px-2 py-2 text-xs text-slate-300 hover:bg-slate-600 disabled:opacity-60"
              title="Force Refresh Options"
            >
              ▼
            </button>

            {/* Dropdown menu */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-10 w-40 bg-slate-800 border border-slate-700 rounded-md shadow-lg z-50">
                <button
                  type="button"
                  onClick={() => {
                    props.setForceRefreshHint(false);
                    props.handleAnalyze({ preventDefault: () => {} } as any);
                    setDropdownOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-xs text-slate-200 hover:bg-slate-700"
                >
                  Analyze (use cache)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    props.setForceRefreshHint(true);
                    props.handleAnalyze({ preventDefault: () => {} } as any);
                    setDropdownOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-xs text-slate-200 hover:bg-slate-700 border-t border-slate-700"
                >
                  Force refresh
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Error display with aria-live */}
        {props.errorText && (
          <div
            className="mt-3 p-3 rounded-lg bg-red-900/20 border border-red-700/50 text-red-200 text-xs whitespace-pre-wrap font-mono"
            role="alert"
            aria-live="polite"
          >
            {props.errorText}
          </div>
        )}

        {/* Apple Music notice with aria-live */}
        {props.appleNotice && (
          <div
            className="mt-3 p-2 rounded-lg bg-amber-900/20 border border-amber-700/50 text-amber-200 text-xs"
            aria-live="polite"
          >
            ⚠️ Apple Music playlists require browser-based fetching (Playwright). This may take longer.
          </div>
        )}
      </form>
    </section>
  );
}
