"use client";

import React, { useMemo, useRef } from "react";
import ProcessingBar from "./ProcessingBar";
import ErrorAlert from "./ErrorAlert";
import type { ProgressItem } from "./ProgressList";
import type { SavedRekordboxXmlMeta } from "@/lib/storage/savedRekordboxXml";

type ErrorMeta = {
  error_code: string;
  message?: string | null;
  [key: string]: unknown;
};

export interface AnalyzeFormProps {
  playlistUrlInput: string;
  rekordboxFile: File | null;
  rekordboxDate?: string | null;
  rekordboxFilename?: string | null;
  savedRekordboxXmlMeta?: SavedRekordboxXmlMeta | null;
  savedRekordboxXmlBusy?: boolean;
  savedRekordboxXmlError?: string | null;

  loading: boolean;
  isReanalyzing: boolean;
  progress: number;
  phaseLabel?: string | null;

  errorText: string | null;
  errorMeta?: ErrorMeta;

  banner?: { kind: "error" | "info"; text: string } | null;
  onDismissBanner?: () => void;

  progressItems: ProgressItem[];

  setPlaylistUrlInput: (value: string) => void;
  setRekordboxFile: (file: File | null) => void;
  handleAnalyze: (e: React.FormEvent) => void;
  handleRekordboxChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  useSavedRekordboxXml?: () => void;
  forgetSavedRekordboxXml?: () => void;
  setForceRefreshHint: (value: boolean) => void;

  cancelAnalyze?: () => void;
  retryFailed?: () => void;

  playlistUrlError?: string | null;
}

const MAX_XML_BYTES = 50 * 1024 * 1024;

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return "-";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(value: string | number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export default function AnalyzeForm(props: AnalyzeFormProps) {
  const playlistInputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const xmlName =
    props.rekordboxFilename ??
    props.savedRekordboxXmlMeta?.filename ??
    "No XML selected";
  const hasXml = Boolean(
    props.rekordboxFilename || props.savedRekordboxXmlMeta,
  );

  const messageFromMeta = useMemo(() => {
    const m = props.errorMeta?.message;
    return typeof m === "string" && m.trim() ? m : null;
  }, [props.errorMeta]);

  const playlistUrlError = useMemo(() => {
    const code = props.errorMeta?.error_code;
    if (code === "PLAYLIST_INVALID")
      return messageFromMeta ?? "Enter a Spotify playlist URL, URI, or ID.";
    return null;
  }, [props.errorMeta, messageFromMeta]);

  const localXmlError = useMemo(() => {
    const file = props.rekordboxFile;
    if (!file) return null;
    if (file.size > MAX_XML_BYTES) return "XML file too large (max 50MB)";

    const code = props.errorMeta?.error_code;
    if (code === "XML_TOO_LARGE" || code === "XML_PARSE_FAILED") {
      return messageFromMeta ?? "XML error";
    }
    return null;
  }, [props.rekordboxFile, props.errorMeta, messageFromMeta]);
  const replaceXml = () => {
    fileInputRef.current?.click();
  };
  const removeXml = () => {
    if (props.savedRekordboxXmlMeta) {
      props.forgetSavedRekordboxXml?.();
      return;
    }

    props.setRekordboxFile(null);
  };

  return (
    <section className="w-full space-y-8">
      {props.banner?.text ? (
        <div
          className={`rounded-md border px-3 py-2 text-xs ${
            props.banner.kind === "error"
              ? "border-rose-800/70 bg-rose-950/30 text-rose-100"
              : "border-slate-800 bg-transparent text-slate-300"
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

      <form onSubmit={props.handleAnalyze} className="space-y-8">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xml"
          onChange={props.handleRekordboxChange}
          className="hidden"
        />

        <div className="flex flex-col gap-3 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <span aria-hidden="true" className="text-slate-600">
              ▫
            </span>
            <span className="font-medium text-slate-500">Library XML</span>
            <span className="text-slate-700">·</span>
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                hasXml ? "bg-emerald-400" : "bg-slate-700"
              }`}
            />
            <span className="truncate font-medium text-slate-300">
              {xmlName}
            </span>
            <span className="truncate text-slate-600">
              {props.savedRekordboxXmlMeta
                ? `${formatBytes(props.savedRekordboxXmlMeta.size)} · updated ${formatDateTime(
                    props.savedRekordboxXmlMeta.lastModified,
                  )}`
                : props.rekordboxDate
                  ? `updated ${props.rekordboxDate}`
                  : "Upload Rekordbox XML"}
            </span>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={replaceXml}
              disabled={props.savedRekordboxXmlBusy}
              className="text-slate-500 hover:text-slate-300 disabled:opacity-40"
            >
              Upload
            </button>
            {hasXml ? (
              <button
                type="button"
                onClick={removeXml}
                disabled={props.savedRekordboxXmlBusy}
                className="text-slate-600 hover:text-slate-400 disabled:opacity-40"
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-stretch gap-3">
            <textarea
              ref={playlistInputRef}
              value={props.playlistUrlInput}
              onChange={(e) => props.setPlaylistUrlInput(e.target.value)}
              rows={1}
              placeholder="Paste Spotify playlist URL"
              className={`min-h-0 w-full resize-none rounded-lg border bg-transparent px-4 py-3 text-sm font-medium text-slate-100 outline-none placeholder:text-slate-600 ${
                props.playlistUrlError || playlistUrlError
                  ? "border-rose-500/60"
                  : "border-white/10 focus:border-white/20"
              }`}
            />
            <button
              type="submit"
              disabled={
                props.loading ||
                !!localXmlError ||
                !props.playlistUrlInput.trim()
              }
              className="min-w-36 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-200 disabled:bg-white/10 disabled:text-white/20"
            >
              Analyze
            </button>
          </div>
          {props.playlistUrlError || playlistUrlError ? (
            <div className="text-xs text-rose-300">
              <div className="font-semibold">Invalid playlist input</div>
              <div>{props.playlistUrlError || playlistUrlError}</div>
            </div>
          ) : null}
          {localXmlError ? (
            <div className="text-xs text-rose-300">{localXmlError}</div>
          ) : null}
          {props.savedRekordboxXmlError ? (
            <div className="text-xs text-rose-300">
              {props.savedRekordboxXmlError}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {props.cancelAnalyze && props.loading ? (
            <button
              type="button"
              onClick={() => props.cancelAnalyze?.()}
              className="rounded-md border border-slate-700/70 bg-transparent px-3 py-2 text-sm text-slate-300 hover:border-slate-600 hover:bg-slate-800/50 hover:text-white"
            >
              Cancel
            </button>
          ) : null}

          {props.retryFailed && !props.loading && props.errorText ? (
            <button
              type="button"
              onClick={() => props.retryFailed?.()}
              className="rounded-md border border-slate-700/70 bg-transparent px-3 py-2 text-sm text-slate-300 hover:border-slate-600 hover:bg-slate-800/50 hover:text-white"
            >
              Retry
            </button>
          ) : null}
        </div>

        {props.loading ? (
          <div className="pt-2">
            <ProcessingBar
              analyzing={props.loading}
              reanalyzing={props.isReanalyzing}
              progress={props.progress}
              phaseLabel={props.phaseLabel}
            />
          </div>
        ) : null}

        {props.errorText && !playlistUrlError ? (
          <div className="pt-2">
            <ErrorAlert
              title="Error"
              message={props.errorText}
              details={
                props.errorMeta
                  ? JSON.stringify(props.errorMeta, null, 2)
                  : undefined
              }
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
