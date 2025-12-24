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
  // Error for first input only
  playlistUrlError?: string | null;
}
const MAX_URLS = 3;
function splitUrls(multiline: string): string[] {
  const raw = (multiline || '').split('\n').map(s => s.trim()).filter(Boolean);
  return raw.length ? raw.slice(0, MAX_URLS) : [''];
}
function joinUrls(urls: string[]): string {
  return urls.map(s => (s || '').trim()).filter(Boolean).join('\n');
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

  useEffect(() => {
    if (props.errorText && errorSummaryRef.current) {
      errorSummaryRef.current.focus();
    }
  }, [props.errorText]);

  // --- Apple-like URL input array ---
  const [urls, setUrls] = useState<string[]>(() => splitUrls(props.playlistUrlInput));
  useEffect(() => {
    setUrls(splitUrls(props.playlistUrlInput));
  }, [props.playlistUrlInput]);
  function updateUrlAt(i: number, next: string) {
    const nextUrls = urls.slice();
    nextUrls[i] = next;
    setUrls(nextUrls);
    props.setPlaylistUrlInput(joinUrls(nextUrls));
  }
  function addUrl() {
    if (urls.length >= MAX_URLS) return;
    const nextUrls = urls.concat(['']);
    setUrls(nextUrls);
    props.setPlaylistUrlInput(joinUrls(nextUrls));
  }
  function removeUrl(i: number) {
    if (urls.length <= 1) return;
    const nextUrls = urls.filter((_, idx) => idx !== i);
    setUrls(nextUrls);
    props.setPlaylistUrlInput(joinUrls(nextUrls));
  }

  return (
    <section className="ps-card max-w-2xl mx-auto p-6">
      <form onSubmit={props.handleAnalyze} className="">
        {/* Error summary (page-level) */}
        {props.errorText && (
          <div ref={errorSummaryRef} id="error-summary" className="ps-row">
            <ErrorAlert
              title="There was a problem"
              message={props.errorText}
              details={hasMeta ? metaJson : undefined}
            />
          </div>
        )}
        {/* Persistent banner (Apple block, etc) */}
        {props.banner ? (
          <div className="ps-row">
            <div
              className={[
                "w-full rounded-xl border p-3 text-sm",
                props.banner.kind === "error"
                  ? "border-red-500/30 bg-red-500/10 text-red-100"
                  : "border-white/10 bg-white/5 text-white/80",
              ].join(" ")}
              role={props.banner.kind === "error" ? "alert" : "status"}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 whitespace-pre-wrap">{props.banner.text}</div>
                {props.onDismissBanner ? (
                  <button
                    type="button"
                    onClick={props.onDismissBanner}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs text-white/70 hover:bg-white/10"
                    aria-label="Dismiss"
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {/* Playlist URL input(s) - Apple-like row */}
        {/* Playlist URL Row */}
        <div className="grid grid-cols-[180px,1fr] gap-6 items-start py-4">
          <div>
            <label className="text-sm font-medium text-white/90" htmlFor="playlist-url-0">Playlist URL</label>
            <div className="mt-1 text-xs text-white/50">Spotify playlist or ID</div>
          </div>
          <div>
            <div className="space-y-2">
              {urls.map((url, idx) => {
                const showRemove = urls.length > 1;
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      id={`playlist-url-${idx}`}
                      value={url}
                      onChange={(e) => updateUrlAt(idx, e.target.value)}
                      className="h-11 w-full rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white/90 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-white/20 transition"
                      placeholder="Playlist URL…"
                      inputMode="url"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                    {showRemove && (
                      <button
                        type="button"
                        onClick={() => removeUrl(idx)}
                        className="text-white/40 hover:text-white/70 px-2 py-1"
                        aria-label="Remove URL"
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Add another/Up to 3 row */}
            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={addUrl}
                disabled={urls.length >= MAX_URLS}
                className="text-blue-400 hover:text-blue-300 disabled:opacity-50 disabled:pointer-events-none text-sm"
              >
                + Add another
              </button>
              <span className="text-xs text-white/40">Up to {MAX_URLS}</span>
            </div>
            {/* エラーは各input直下に1行固定（既存のplaylistUrlErrorは最初の入力に紐付け） */}
            {props.playlistUrlError && (
              <p className="mt-1 text-xs text-red-500">{props.playlistUrlError}</p>
            )}
          </div>
        </div>

        {/* Rekordbox XML Row */}
        <div className="grid grid-cols-[180px,1fr] gap-6 items-start py-4">
          <div>
            <label className="text-sm font-medium text-white/90">Rekordbox Collection XML</label>
            <div className="mt-1 text-xs text-white/50">(optional)</div>
          </div>
          <div>
            <input
              ref={rekordboxInputRef}
              id="rekordbox-file-input"
              type="file"
              accept=".xml"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f && f.size > MAX_XML_BYTES) {
                  setLocalXmlError(`XML is too large. Please export smaller, playlist-level XML from Rekordbox and try again.`);
                  e.target.value = '';
                  return;
                }
                setLocalXmlError(null);
                props.setRekordboxFile(f ?? null);
              }}
              className="sr-only"
            />
            <div className="flex items-center gap-2">
              {!props.rekordboxFilename ? (
                <label htmlFor="rekordbox-file-input" className="h-11 px-4 rounded-xl bg-white/10 border border-white/20 text-white/80 text-sm flex items-center cursor-pointer hover:bg-white/20 transition">
                  Choose file…
                </label>
              ) : (
                <>
                  <span className="font-mono text-xs text-slate-300 truncate max-w-[120px]">{props.rekordboxFilename.length > 24 ? props.rekordboxFilename.slice(0, 20) + '…' : props.rekordboxFilename}</span>
                  <label htmlFor="rekordbox-file-input" className="ps-link ml-2 cursor-pointer">Change</label>
                  <button type="button" className="ps-link ml-1 text-red-400" onClick={() => props.setRekordboxFile(null)}>Remove</button>
                </>
              )}
            </div>
            {localXmlError && (
              <div className="mt-1 text-xs text-red-500">{localXmlError}</div>
            )}
          </div>
        </div>

        {/* Unowned toggle row (Switch) */}
        <div className="grid grid-cols-[180px,1fr] gap-6 items-start py-4">
          <div>
            <label htmlFor="only-unowned" className="text-sm font-medium text-white/90">Show only unowned</label>
          </div>
          <div>
            <div className="flex items-center justify-between w-full">
              <span className="text-sm text-white/80">Show only unowned tracks</span>
              {/* Custom Switch */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={props.onlyUnowned}
                  onChange={e => props.setOnlyUnowned(e.target.checked)}
                  className="sr-only peer"
                  id="only-unowned"
                />
                <div className="w-11 h-6 bg-white/10 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/40 rounded-full peer peer-checked:bg-blue-500 transition-all"></div>
                <div className="absolute left-0.5 top-0.5 bg-white w-5 h-5 rounded-full shadow-md transition-all peer-checked:translate-x-5"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Analyze button row */}
        <div className="pt-4 flex items-center justify-end">
          <button
            type="submit"
            data-testid="analyze-btn"
            disabled={isProcessing || !urls.some((u) => (u || "").trim().length > 0)}
            className="h-11 px-5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed border-0"
          >
            {isProcessing ? (
              <>
                <div className="inline-block h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-r-transparent" />
                {'Analyzing…'}
              </>
            ) : (
              'Analyze'
            )}
          </button>
        </div>

        {/* StatusRow: unified status display at bottom */}
        <div className="ps-row mt-2">
          {(isProcessing || props.progress > 0 || props.playlistUrlError || localXmlError) && (
            <div className="rounded bg-slate-800/60 px-3 py-2 text-sm text-slate-200 flex items-center gap-2 min-h-[32px] w-full">
              {isProcessing ? (
                <>
                  <span className="inline-block h-2 w-2 rounded-full bg-blue-400" />
                  <span>
                    {props.progress > 0 ? `Analyzing… ${props.progress}%` : "Analyzing…"}
                  </span>
                </>
              ) : (props.playlistUrlError || localXmlError) ? (
                <>
                  <span className="inline-block h-2 w-2 rounded-full bg-rose-400" />
                  <span>{props.playlistUrlError || localXmlError}</span>
                </>
              ) : (
                <>
                  <span className="inline-block h-2 w-2 rounded-full bg-slate-400" />
                  <span>Ready</span>
                </>
              )}
            </div>
          )}
        </div>
      </form>
    </section>
  );
}
