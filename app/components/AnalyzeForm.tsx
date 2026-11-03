"use client";

import React, { useMemo, useRef } from "react";
import ProcessingBar from "./ProcessingBar";
import ErrorAlert from "./ErrorAlert";
import type { ProgressItem } from "./ProgressList";
import type { SavedRekordboxXmlMeta } from "@/lib/storage/savedRekordboxXml";
import MobileDesktopHandoff from "./MobileDesktopHandoff";
import { MAX_XML_BYTES } from "@/lib/constants";

type ErrorMeta = {
  error_code: string;
  message?: string | null;
  [key: string]: unknown;
};

export interface AnalyzeFormProps {
  playlistUrlInput: string;
  activePlaylistInput?: string | null;
  activePlaylistId?: string | null;
  queryPlaylist?: string | null;
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
    props.rekordboxFile ||
    props.rekordboxFilename ||
    props.savedRekordboxXmlMeta,
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
  const visiblePlaylistError = props.playlistUrlError || playlistUrlError;
  const visibleXmlError = localXmlError || props.savedRekordboxXmlError;
  const hasRetryableError = Boolean(
    props.errorText && !visiblePlaylistError && !visibleXmlError,
  );
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
    <section className="w-full space-y-6">
      {props.banner?.text ? (
        <div
          role={props.banner.kind === "error" ? "alert" : "status"}
          className={`rounded-md border px-3 py-2 text-sm ${
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

      <form onSubmit={props.handleAnalyze} className="space-y-6">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xml"
          aria-label="Upload Rekordbox XML"
          aria-describedby="xml-help"
          onChange={props.handleRekordboxChange}
          className="hidden"
        />

        <div className="space-y-2">
          <label
            htmlFor="playlist-url"
            className="block text-sm font-semibold text-slate-200"
          >
            <span className="mr-2 text-slate-400">1.</span>
            Spotify playlist
          </label>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row">
            <textarea
              id="playlist-url"
              ref={playlistInputRef}
              value={props.playlistUrlInput}
              onChange={(e) => props.setPlaylistUrlInput(e.target.value)}
              rows={1}
              placeholder="Paste Spotify playlist URL"
              aria-invalid={visiblePlaylistError ? true : undefined}
              aria-describedby={
                visiblePlaylistError ? "playlist-url-error" : undefined
              }
              className={`min-h-11 w-full resize-none rounded-lg border bg-transparent px-4 py-3 text-sm font-medium text-slate-100 outline-none placeholder:text-slate-500 ${
                visiblePlaylistError
                  ? "border-rose-400"
                  : "border-white/15 focus:border-white/40"
              }`}
            />
          </div>
          {visiblePlaylistError ? (
            <div
              id="playlist-url-error"
              role="alert"
              className="text-sm text-rose-300"
            >
              <div className="font-semibold">Invalid playlist input</div>
              <div>{visiblePlaylistError}</div>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <div
            id="xml-heading"
            className="text-sm font-semibold text-slate-200"
          >
            <span className="mr-2 text-slate-400">2.</span>
            Rekordbox library{" "}
            <span className="font-normal text-slate-400">
              (needed to check ownership)
            </span>
          </div>
          <p id="xml-help" className="text-sm leading-6 text-slate-400">
            Choose a Rekordbox XML export, up to 50 MB. Without XML, you can
            browse tracks and store links, but ownership stays unverified.
          </p>
          <details className="text-sm text-slate-300">
            <summary className="cursor-pointer rounded-sm py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40">
              How to export your Rekordbox XML
            </summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5 leading-6 text-slate-400">
              <li>Open Rekordbox on your computer.</li>
              <li>
                In the File menu, choose “Export Collection in xml format”.
              </li>
              <li>Save the .xml file, then upload it here.</li>
            </ol>
            <a
              href="https://rekordbox.com/en/support/faq/operation-hints-7/"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block underline underline-offset-4 hover:text-white"
            >
              Rekordbox export help
            </a>
          </details>
          <div className="flex flex-col gap-3 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  hasXml ? "bg-emerald-400" : "bg-slate-700"
                }`}
              />
              <span className="truncate font-medium text-slate-300">
                {xmlName}
              </span>
              <span className="truncate text-slate-400">
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
                className="rounded-md border border-white/15 px-3 py-2 text-slate-200 hover:border-white/30 disabled:opacity-40"
              >
                Upload
              </button>
              {hasXml ? (
                <button
                  type="button"
                  onClick={removeXml}
                  disabled={props.savedRekordboxXmlBusy}
                  className="px-2 py-2 text-slate-400 hover:text-slate-100 disabled:opacity-40"
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>
          {localXmlError ? (
            <div role="alert" className="text-sm text-rose-300">
              {localXmlError}
            </div>
          ) : null}
          {props.savedRekordboxXmlError ? (
            <div role="alert" className="text-sm text-rose-300">
              {props.savedRekordboxXmlError}
            </div>
          ) : null}
        </div>

        <MobileDesktopHandoff
          playlistInput={props.playlistUrlInput}
          activePlaylistInput={props.activePlaylistInput}
          activePlaylistId={props.activePlaylistId}
          queryPlaylist={props.queryPlaylist}
        />

        <div className="space-y-3 border-t border-white/10 pt-6">
          <div className="text-sm font-semibold text-slate-200">
            <span className="mr-2 text-slate-400">3.</span>
            {hasXml ? "Check your library" : "Browse the playlist"}
          </div>
          <button
            type="submit"
            disabled={
              props.loading ||
              props.savedRekordboxXmlBusy ||
              !!localXmlError ||
              !props.playlistUrlInput.trim()
            }
            aria-describedby="analysis-help"
            className="min-h-11 w-full rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:bg-white/10 disabled:text-white/30 sm:w-auto sm:min-w-44"
          >
            {hasXml ? "Check ownership" : "Browse playlist"}
          </button>
          <p id="analysis-help" className="text-sm leading-6 text-slate-400">
            {hasXml
              ? "Compare this playlist with your selected XML to find tracks missing from your library."
              : "No XML selected. Tracks will be marked Unverified until you check them with XML."}
          </p>
          <p className="text-xs leading-5 text-slate-400">
            Uploaded XML is saved in this browser for reuse and sent to the
            server for matching. Use Remove to delete the browser’s saved XML.
          </p>
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

          {props.retryFailed && !props.loading && hasRetryableError ? (
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

        {hasRetryableError ? (
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
