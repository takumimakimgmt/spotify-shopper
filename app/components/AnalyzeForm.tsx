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
          <div
            className={[
              "mt-3 rounded-xl border p-3 text-sm",
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
        ) : null}

        {/* Playlist URL input(s) - Apple-like */}
        <label className="text-sm font-medium" htmlFor="playlist-url-0">Playlist URL</label>
        <div className="mt-2 space-y-2">
          {urls.map((url, idx) => {
            const showRemove = urls.length > 1;
            return (
              <div key={idx}>
                <div className="flex items-center gap-2">
                  <input
                    id={`playlist-url-${idx}`}
                    value={url}
                    onChange={(e) => updateUrlAt(idx, e.target.value)}
                    className="w-full rounded-xl border px-3 py-2 text-sm"
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
                      className="rounded-xl border px-3 py-2 text-sm"
                      aria-label="Remove URL"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {/* エラーは各input直下に1行固定（既存のplaylistUrlErrorは最初の入力に紐付け） */}
                {idx === 0 && props.playlistUrlError && (
                  <p className="mt-1 text-xs text-red-600">{props.playlistUrlError}</p>
                )}
              </div>
            );
          })}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={addUrl}
              disabled={urls.length >= MAX_URLS}
              className="rounded-xl border px-3 py-2 text-sm disabled:opacity-50"
            >
              + Add another
            </button>
            <p className="text-xs text-neutral-500">Up to {MAX_URLS}</p>
          </div>
        </div>

        {/* Rekordbox XML Dropzone-style input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Rekordbox Collection XML (optional)</label>
          <div
            className="border-2 border-dashed border-slate-700 rounded-lg p-3 text-center cursor-pointer bg-slate-950/60 hover:bg-slate-900"
            onClick={handleRekordboxClick}
            onDrop={e => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f && f.type === 'text/xml') {
                props.setRekordboxFile(f);
              }
            }}
            onDragOver={e => e.preventDefault()}
          >
            {props.rekordboxFilename ? (
              <span className="font-mono text-xs text-slate-300">{props.rekordboxFilename.length > 24 ? props.rekordboxFilename.slice(0, 20) + '…' : props.rekordboxFilename}</span>
            ) : (
              <span className="text-xs text-slate-400">Drag & drop XML here, or choose file</span>
            )}
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
              className="hidden"
            />
            {props.rekordboxFilename && (
              <button type="button" className="ml-2 text-xs px-2 py-1 rounded bg-slate-800 text-white/80 hover:bg-slate-700" onClick={() => props.setRekordboxFile(null)}>Change</button>
            )}
          </div>
          {/* XML error below input */}
          {localXmlError && (
            <div className="text-xs text-red-400 mt-1">{localXmlError}</div>
          )}
        </div>
        {/* Unowned toggle below XML */}
        <div className="flex items-center gap-2 mt-2">
          <input
            type="checkbox"
            checked={props.onlyUnowned}
            onChange={e => props.setOnlyUnowned(e.target.checked)}
            className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-emerald-500"
            id="only-unowned"
          />
          <label htmlFor="only-unowned" className="text-sm text-slate-200">Show only unowned tracks</label>
        </div>

        {/* Analyze button right-bottom fixed in form */}
        <div className="flex justify-end mt-4">
          <button
            type="submit"
            data-testid="analyze-btn"
            disabled={isProcessing || !urls.some((u) => (u || "").trim().length > 0)}
            className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-5 py-2 text-sm font-medium text-black hover:bg-emerald-400 disabled:opacity-60"
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
        <div className="mt-4">
          {(isProcessing || props.progress > 0 || props.playlistUrlError || localXmlError) && (
            <div className="rounded bg-slate-800/60 px-3 py-2 text-sm text-slate-200 flex items-center gap-2 min-h-[32px]">
              {isProcessing ? (
                <>
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
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
