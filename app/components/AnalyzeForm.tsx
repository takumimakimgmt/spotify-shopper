'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ProcessingBar from './ProcessingBar';
import { ProgressItem } from './ProgressList';
import { APPLE_TIMEOUT_S } from '@/lib/constants';

export interface AnalyzeFormProps {
  // State
  playlistUrlInput: string;
  rekordboxFile: File | null;
  onlyUnowned: boolean;
  loading: boolean;
  isReanalyzing: boolean;
  progress: number;
  errorText: string | null;
  errorMeta?: any;
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
  const [detailsExpanded, setDetailsExpanded] = useState(false);
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
            className="rounded-md border border-red-500 bg-red-900/40 px-3 py-2 text-xs text-red-100 space-y-2"
            role="alert"
            aria-live="polite"
          >
            <p className="font-semibold">There was a problem</p>
            <p className="text-red-200">{props.errorText}</p>
            {props.errorMeta && (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setDetailsExpanded(!detailsExpanded)}
                  className="text-xs text-red-200 hover:text-red-100 underline"
                >
                  {detailsExpanded ? 'Hide details' : 'Show details'}
                </button>
                {detailsExpanded && (
                  <div className="mt-2 space-y-2">
                    <div className="bg-slate-950/50 rounded p-2 font-mono text-[10px] space-y-1">
                      {props.errorMeta.reason && (
                        <div><span className="text-slate-400">reason:</span> {props.errorMeta.reason}</div>
                      )}
                      {props.errorMeta.apple_playwright_phase && (
                        <div><span className="text-slate-400">phase:</span> {props.errorMeta.apple_playwright_phase}</div>
                      )}
                      {props.errorMeta.apple_http_status && (
                        <div><span className="text-slate-400">http_status:</span> {props.errorMeta.apple_http_status}</div>
                      )}
                      {props.errorMeta.apple_final_url && (
                        <div className="break-all"><span className="text-slate-400">final_url:</span> {props.errorMeta.apple_final_url}</div>
                      )}
                      {props.errorMeta.apple_api_candidates && props.errorMeta.apple_api_candidates.length > 0 && (
                        <div><span className="text-slate-400">api_candidates:</span> {props.errorMeta.apple_api_candidates.length} items</div>
                      )}
                      {props.errorMeta.apple_response_candidates && props.errorMeta.apple_response_candidates.length > 0 && (
                        <div><span className="text-slate-400">response_candidates:</span> {props.errorMeta.apple_response_candidates.length} items</div>
                      )}
                      {props.errorMeta.apple_request_candidates && props.errorMeta.apple_request_candidates.length > 0 && (
                        <div><span className="text-slate-400">request_candidates:</span> {props.errorMeta.apple_request_candidates.length} items</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const json = JSON.stringify(props.errorMeta, null, 2);
                        navigator.clipboard.writeText(json);
                      }}
                      className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-1 rounded"
                    >
                      Copy details
                    </button>
                  </div>
                )}
              </div>
            )}
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
            <div className="space-y-2">
              <p className="text-xs text-amber-200">
                Apple Music may take up to {APPLE_TIMEOUT_S}s (browser rendering + Spotify enrichment). If it times out, retry with a single Apple URL.
              </p>
              <p className="text-xs text-yellow-600/80">
                ⚠ Beta: Apple Music support is less reliable than Spotify and may fail or take longer.
              </p>
            </div>
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

          {/* Analyze button and controls */}
          <div className="flex flex-col gap-2">
            <div className="flex gap-2 items-center">
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

              {/* Force reload removed per simplified UI */}
            </div>
            {/* Timing hint moved to processing-only context */}
          </div>
        </div>

        {/* Error display with aria-live */}
        {props.errorText && (
          <div className="sr-only" aria-live="polite">{props.errorText}</div>
        )}
      </form>
    </section>
  );
}
