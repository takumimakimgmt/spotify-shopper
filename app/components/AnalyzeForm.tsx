'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ProcessingBar from './ProcessingBar';
import ErrorAlert from './ErrorAlert';
import type { ProgressItem } from './ProgressList';

type ErrorMeta = { error_code: string; message?: string | null; [key: string]: unknown };

export interface AnalyzeFormProps {
  playlistUrlInput: string;
  rekordboxFile: File | null;
  rekordboxDate?: string | null;
  rekordboxFilename?: string | null;

  loading: boolean;
  isReanalyzing: boolean;
  progress: number;

  errorText: string | null;
  errorMeta?: ErrorMeta;

  banner?: { kind: 'error' | 'info'; text: string } | null;
  onDismissBanner?: () => void;

  progressItems: ProgressItem[];

  setPlaylistUrlInput: (value: string) => void;
  setRekordboxFile: (file: File | null) => void;
  handleAnalyze: (e: React.FormEvent) => void;
  handleRekordboxChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setForceRefreshHint: (value: boolean) => void;

  cancelAnalyze?: () => void;
  retryFailed?: () => void;

  playlistUrlError?: string | null;
}

const MAX_XML_BYTES = 50 * 1024 * 1024;

export default function AnalyzeForm(props: AnalyzeFormProps) {
  const [localXmlError, setLocalXmlError] = useState<string | null>(null);
  const [playlistUrlError, setPlaylistUrlError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const messageFromMeta = useMemo(() => {
    const m = props.errorMeta?.message;
    return typeof m === 'string' && m.trim() ? m : null;
  }, [props.errorMeta]);

  useEffect(() => {
    const meta = props.errorMeta;
    if (!meta) {
      setLocalXmlError(null);
      setPlaylistUrlError(null);
      return;
    }

    const code = meta.error_code;

    if (code === 'XML_TOO_LARGE' || code === 'XML_PARSE_FAILED') {
      setLocalXmlError(messageFromMeta ?? 'XML error');
      setPlaylistUrlError(null);
      return;
    }

    if (code === 'PLAYLIST_INVALID') {
      setPlaylistUrlError(messageFromMeta ?? 'Invalid playlist URL');
      setLocalXmlError(null);
      return;
    }

    setLocalXmlError(null);
    setPlaylistUrlError(null);
  }, [props.errorMeta, messageFromMeta]);

  useEffect(() => {
    if (!props.rekordboxFile) {
      setLocalXmlError(null);
      return;
    }
    if (props.rekordboxFile.size > MAX_XML_BYTES) {
      setLocalXmlError('XML file too large (max 50MB)');
    } else if (props.errorMeta?.error_code !== 'XML_PARSE_FAILED') {
      setLocalXmlError(null);
    }
  }, [props.rekordboxFile, props.errorMeta]);

  const clearXml = () => {
    props.setRekordboxFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setLocalXmlError(null);
  };

  return (
    <section className="w-full max-w-4xl mx-auto p-4 space-y-4">
      {props.banner?.text ? (
        <div
          className={`rounded-lg p-3 text-sm ${
            props.banner.kind === 'error'
              ? 'bg-rose-950/50 border border-rose-800'
              : 'bg-slate-900/50 border border-slate-800'
          }`}
        >
          <div className="flex items-start gap-2">
            <div className="flex-1">{props.banner.text}</div>
            {props.onDismissBanner ? (
              <button
                type="button"
                onClick={props.onDismissBanner}
                className="text-slate-300 hover:text-white"
                aria-label="Dismiss"
              >
                ✕
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <form onSubmit={props.handleAnalyze} className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-200">Playlist URL(s)</label>
          <textarea
            value={props.playlistUrlInput}
            onChange={(e) => props.setPlaylistUrlInput(e.target.value)}
            rows={3}
            placeholder="Spotify playlist URL"
            className={`w-full rounded-md bg-slate-900 border px-3 py-2 text-sm outline-none ${
              (props.playlistUrlError || playlistUrlError) ? 'border-rose-500/60' : 'border-slate-700'
            }`}
          />
          {(props.playlistUrlError || playlistUrlError) ? (
            <div className="text-xs text-rose-300">{props.playlistUrlError || playlistUrlError}</div>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-200">Rekordbox XML (optional)</label>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml"
              onChange={props.handleRekordboxChange}
              className="block w-full text-sm text-slate-200 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-slate-800 file:text-slate-100 hover:file:bg-slate-700"
            />
            {props.rekordboxFile ? (
              <button
                type="button"
                onClick={clearXml}
                className="text-xs px-2 py-1 rounded-md border border-slate-700 text-slate-300 hover:text-white"
              >
                Clear
              </button>
            ) : null}
          </div>

          {props.rekordboxFilename ? (
            <div className="text-xs text-slate-400">
              {props.rekordboxFilename}
              {props.rekordboxDate ? ` · ${props.rekordboxDate}` : ''}
            </div>
          ) : null}

          {localXmlError ? <div className="text-xs text-rose-300">{localXmlError}</div> : null}
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            className="rounded border-slate-700 bg-slate-900"
          />
          Only unowned
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={props.loading || !!localXmlError}
            className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40"
          >
            {props.isReanalyzing ? 'Reanalyze' : 'Analyze'}
          </button>

          {props.cancelAnalyze && props.loading ? (
            <button
              type="button"
              onClick={() => props.cancelAnalyze?.()}
              className="px-3 py-2 rounded-md border border-slate-700 text-slate-200 hover:text-white"
            >
              Cancel
            </button>
          ) : null}

          {props.retryFailed && !props.loading && props.errorText ? (
            <button
              type="button"
              onClick={() => props.retryFailed?.()}
              className="px-3 py-2 rounded-md border border-slate-700 text-slate-200 hover:text-white"
            >
              Retry
            </button>
          ) : null}
        </div>

        {props.loading ? (
          <div className="pt-2">
            <ProcessingBar analyzing={props.loading} reanalyzing={props.isReanalyzing} progress={props.progress} />
          </div>
        ) : null}

        {props.errorText ? (
          <div className="pt-2">
            <ErrorAlert
              title="Error"
              message={props.errorText}
              details={props.errorMeta ? JSON.stringify(props.errorMeta, null, 2) : undefined}
              hint="If this looks stale, try a hard refresh."
            />
            <div className="pt-2">
              <button
                type="button"
                onClick={() => props.setForceRefreshHint(true)}
                className="text-xs px-2 py-1 rounded-md border border-slate-700 text-slate-300 hover:text-white"
              >
                Show refresh tips
              </button>
            </div>
          </div>
        ) : null}
      </form>
    </section>
  );
}
