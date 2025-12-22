'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ProcessingBar from './ProcessingBar';
import ErrorAlert from './ErrorAlert';
import { ProgressItem } from './ProgressList';
import { MAX_XML_BYTES } from '@/lib/constants';

type ErrorMeta = Record<string, unknown>;

export interface AnalyzeFormProps {
  // State
  playlistUrlInput: string;
  rekordboxFile: File | null;
  onlyUnowned: boolean;
  rekordboxDate?: string | null;
  rekordboxFilename?: string | null;
  loading: boolean;
  isReanalyzing: boolean;
  progress: number;
  errorText: string | null;
  banner?: { kind: "error" | "info"; text: string } | null;
  onDismissBanner?: () => void;
  errorMeta?: ErrorMeta;
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
  const [localXmlError, setLocalXmlError] = useState<string | null>(null);
  const rekordboxInputRef = useRef<HTMLInputElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const handleRekordboxClick = () => {
    rekordboxInputRef.current?.click();
  };

  // Check if errorMeta has actual content
  const meta = props.errorMeta ?? null;
  const metaJson =
    meta && typeof meta === 'object' && Object.keys(meta).length > 0
      ? JSON.stringify(meta, null, 2)
      : '';
  const hasMeta = metaJson.length > 0;

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
          <div ref={errorSummaryRef} id="error-summary">
            <ErrorAlert
              title="There was a problem"
              message={props.errorText}
              details={hasMeta ? metaJson : undefined}
            />
          </div>
        )}
        {/* Persistent banner (Apple block, etc) */}
        {props.banner ? (
          <div className="mt-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
            <div className={props.banner.kind === "error" ? "text-red-200" : "text-white/80"}>
              {props.banner.text}
            </div>
            <button
              type="button"
              onClick={() => props.onDismissBanner?.()}
              className="mt-1 text-xs text-white/50 hover:text-white/80"
            >
              close
            </button>
          </div>
        ) : null}

        {/* Playlist URLs input */}
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="playlist-urls">Playlist URLs</label>
          <textarea
            id="playlist-urls"
            value={props.playlistUrlInput}
            onChange={(e) => props.setPlaylistUrlInput(e.target.value)}
            className={`w-full rounded-md border ${props.errorText ? 'border-red-500' : 'border-slate-700'} bg-slate-950/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono`}
            placeholder="Spotify playlist URL\nApple Music URL\nPlaylist ID (optional)"
            rows={4}
            aria-invalid={props.errorText ? 'true' : 'false'}
            aria-describedby={props.errorText ? 'error-summary' : undefined}
          />
          <p className="text-xs text-slate-400">
            Full URL or playlist ID. Multiple playlists will be analyzed in parallel and results shown in tabs.
          </p>
          {isAppleInput && (
            <div className="space-y-2">
              <p className="text-xs text-amber-200">
                Apple Music can be slower than Spotify. If it fails, retry with a single Apple URL.
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
          {localXmlError && (
            <ErrorAlert title="XML too large" message={localXmlError} />
          )}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <input
              ref={rekordboxInputRef}
              id="rekordbox-file-input"
              type="file"
              accept=".xml"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && f.size > MAX_XML_BYTES) {
                  const mb = (f.size / (1024 * 1024)).toFixed(1);
                  setLocalXmlError(`XML is too large (${mb} MB). Please export smaller, playlist-level XML from Rekordbox and try again.`);
                  e.target.value = '';
                  return;
                }
                setLocalXmlError(null);
                props.handleRekordboxChange(e);
              }}
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
              Rekordbox XML is used on this page for matching your library.
            </span>
            {/* XMLファイル名/日付は補助的に表示（source of truthはcurrentResult.rekordboxMeta） */}
            {(props.rekordboxFilename || props.rekordboxDate) && (
              <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-2">
                {props.rekordboxFilename && (
                  <span className="bg-slate-800/40 rounded px-2 py-0.5 font-medium">
                    {props.rekordboxFilename}
                  </span>
                )}
                {props.rekordboxDate && (
                  <span>Updated: {props.rekordboxDate}</span>
                )}
              </div>
            )}
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
