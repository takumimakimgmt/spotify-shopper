"use client";

import { useI18n } from "@/lib/i18n/LanguageProvider";
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

function formatDateTime(value: string | number, language: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(language === "ja" ? "ja-JP" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AnalyzeForm(props: AnalyzeFormProps) {
  const { language, t: tr } = useI18n();

  const playlistInputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const xmlName =
    props.rekordboxFilename ??
    props.savedRekordboxXmlMeta?.filename ??
    tr("No XML selected");
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
    if (!file && (props.savedRekordboxXmlMeta?.size ?? 0) > MAX_XML_BYTES)
      return "Saved XML exceeds the 50 MB upload limit. Remove it and select a smaller export.";
    if (!file) return null;
    if (file.size > MAX_XML_BYTES) return "XML file too large (max 50MB)";

    const code = props.errorMeta?.error_code;
    if (code === "XML_TOO_LARGE" || code === "XML_PARSE_FAILED") {
      return messageFromMeta ?? "XML error";
    }
    return null;
  }, [
    props.rekordboxFile,
    props.savedRekordboxXmlMeta,
    props.errorMeta,
    messageFromMeta,
  ]);
  const visiblePlaylistError = props.playlistUrlError || playlistUrlError;
  const visibleXmlError = localXmlError || props.savedRekordboxXmlError;
  const hasRetryableError = Boolean(
    props.errorText && !visiblePlaylistError && !visibleXmlError,
  );
  const showPlaylistCopyHelp =
    hasRetryableError &&
    [
      "SPOTIFY_ACCESS_RESTRICTED",
      "SPOTIFY_PLAYLIST_UNAVAILABLE",
      "SPOTIFY_PLAYLIST_RESTRICTED",
    ].includes(props.errorMeta?.error_code ?? "");
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
            <div className="flex-1">{tr(props.banner.text)}</div>
            {props.onDismissBanner ? (
              <button
                type="button"
                onClick={props.onDismissBanner}
                className="text-slate-300 hover:text-white"
                aria-label={tr("Dismiss")}
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
          aria-label={tr("Upload rekordbox XML")}
          aria-describedby="xml-help"
          onChange={props.handleRekordboxChange}
          className="hidden"
        />

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div className="rounded-2xl border border-emerald-300/25 bg-[#0b1514] p-5 sm:p-6">
            <div className="space-y-2">
              <label
                htmlFor="playlist-url"
                className="block text-sm font-semibold text-slate-200"
              >
                {tr("Spotify playlist")}
              </label>
              <div className="flex flex-col items-stretch gap-3 sm:flex-row">
                <textarea
                  id="playlist-url"
                  ref={playlistInputRef}
                  value={props.playlistUrlInput}
                  onChange={(e) => props.setPlaylistUrlInput(e.target.value)}
                  rows={1}
                  placeholder={tr("Paste Spotify playlist URL")}
                  aria-invalid={visiblePlaylistError ? true : undefined}
                  aria-describedby={
                    visiblePlaylistError ? "playlist-url-error" : undefined
                  }
                  className={`min-h-14 w-full resize-none rounded-lg border bg-transparent px-4 py-3 text-sm font-medium text-slate-100 outline-none placeholder:text-slate-500 ${
                    visiblePlaylistError
                      ? "border-rose-400"
                      : "border-white/20 focus:border-emerald-300/70"
                  }`}
                />
              </div>
              {visiblePlaylistError ? (
                <div
                  id="playlist-url-error"
                  role="alert"
                  className="text-sm text-rose-300"
                >
                  <div className="font-semibold">
                    {tr("Invalid playlist input")}
                  </div>
                  <div>{tr(visiblePlaylistError)}</div>
                </div>
              ) : null}
            </div>
            <p className="mt-3 text-xs text-slate-400">
              {tr("Public playlists · No Spotify login needed")}
            </p>
            <div className="space-y-3 pt-4">
              <button
                type="submit"
                disabled={
                  props.loading ||
                  props.savedRekordboxXmlBusy ||
                  !!localXmlError ||
                  !props.playlistUrlInput.trim()
                }
                aria-describedby="analysis-help"
                className="min-h-12 w-full rounded-lg bg-emerald-300 px-6 py-3 text-sm font-semibold text-[#062016] hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:bg-white/10 disabled:text-slate-400 sm:min-w-52"
              >
                {hasXml ? tr("Match against XML") : tr("Browse playlist")}
              </button>
              <p
                id="analysis-help"
                className="text-sm leading-6 text-slate-400"
              >
                {hasXml
                  ? tr(
                      "Compare this playlist with your selected XML to find tracks missing from your library.",
                    )
                  : tr("No XML? You can add it after opening the playlist.")}
              </p>
            </div>
          </div>
          <aside
            aria-labelledby="xml-heading"
            className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6"
          >
            <div className="space-y-2">
              <div
                id="xml-heading"
                className="text-sm font-semibold text-slate-200"
              >
                {tr("rekordbox library")}{" "}
                <span className="rounded-full bg-white/5 px-2 py-1 text-xs font-normal text-slate-400">
                  {tr("Optional")}
                </span>
              </div>
              <p id="xml-help" className="text-sm leading-6 text-slate-300">
                {tr(
                  "Add your rekordbox XML to check tracks you already have (up to 50 MB).",
                )}
              </p>

              <div className="flex flex-col gap-3 rounded-lg border border-dashed border-white/20 p-4 text-sm text-slate-400">
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
                      ? tr("{size} · updated {date}", {
                          size: formatBytes(props.savedRekordboxXmlMeta.size),
                          date: formatDateTime(
                            props.savedRekordboxXmlMeta.lastModified,
                            language,
                          ),
                        })
                      : props.rekordboxDate
                        ? tr("updated {date}", { date: props.rekordboxDate })
                        : tr("Upload rekordbox XML")}
                  </span>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={replaceXml}
                    disabled={props.savedRekordboxXmlBusy}
                    className="rounded-md border border-white/15 px-3 py-2 text-slate-200 hover:border-white/30 disabled:opacity-40"
                  >
                    {tr("Upload")}
                  </button>
                  {hasXml ? (
                    <button
                      type="button"
                      onClick={removeXml}
                      disabled={props.savedRekordboxXmlBusy}
                      className="px-2 py-2 text-slate-400 hover:text-slate-100 disabled:opacity-40"
                    >
                      {tr("Remove")}
                    </button>
                  ) : null}
                </div>
              </div>
              {localXmlError ? (
                <div role="alert" className="text-sm text-rose-300">
                  {tr(localXmlError)}
                </div>
              ) : null}
              {props.savedRekordboxXmlError ? (
                <div role="alert" className="text-sm text-rose-300">
                  {tr(props.savedRekordboxXmlError)}
                </div>
              ) : null}
              <p className="text-xs leading-5 text-slate-400">
                {tr(
                  "XML stays on this device. Not in XML does not prove you do not own a track.",
                )}
              </p>
              <details className="text-sm text-slate-400">
                <summary className="cursor-pointer py-2">
                  {tr("XML help and limitations")}
                </summary>
                <div className="space-y-4 pt-2">
                  {" "}
                  <div className="text-sm text-slate-300">
                    <h3 className="font-medium text-slate-200">
                      {tr("How to export your rekordbox XML")}
                    </h3>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 leading-6 text-slate-400">
                      <li>{tr("Open rekordbox on your computer.")}</li>
                      <li>
                        {tr(
                          "In the File menu, choose “Export Collection in xml format”.",
                        )}
                      </li>
                      <li>{tr("Save the .xml file, then upload it here.")}</li>
                    </ol>
                    <a
                      href="https://rekordbox.com/en/support/faq/operation-hints-7/"
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block underline underline-offset-4 hover:text-white"
                    >
                      {tr("rekordbox export help")}
                    </a>
                  </div>{" "}
                  <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-slate-300">
                    <li>
                      {tr(
                        "The export contains your whole collection, not just one playlist.",
                      )}
                    </li>
                    <li>
                      {tr(
                        "Only tracks included in the XML can be checked. Streaming-only tracks may be absent.",
                      )}
                    </li>
                    <li>
                      {tr(
                        "Files over 50 MB cannot be opened here. Matching runs in your browser; your XML stays on this device.",
                      )}
                    </li>
                  </ul>
                  <p className="rounded-lg border border-amber-300/20 bg-amber-300/5 p-3 text-sm leading-6 text-amber-100">
                    {tr(
                      "Not in your XML means no match in this export, not proof that you do not own the track. Tracks added after export and streaming-only tracks may be absent.",
                    )}
                  </p>
                  <p className="text-xs leading-5 text-slate-400">
                    {tr(
                      "The original XML is saved in this browser for reuse. Library matching runs locally; XML, file paths and recording metadata stay on this device. Use Remove to delete the browser’s saved XML.",
                    )}
                  </p>
                </div>
              </details>
            </div>
          </aside>
        </div>
        <MobileDesktopHandoff
          playlistInput={props.playlistUrlInput}
          activePlaylistInput={props.activePlaylistInput}
          activePlaylistId={props.activePlaylistId}
          queryPlaylist={props.queryPlaylist}
        />

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {props.cancelAnalyze && props.loading ? (
            <button
              type="button"
              onClick={() => props.cancelAnalyze?.()}
              className="rounded-md border border-slate-700/70 bg-transparent px-3 py-2 text-sm text-slate-300 hover:border-slate-600 hover:bg-slate-800/50 hover:text-white"
            >
              {tr("Cancel")}
            </button>
          ) : null}

          {props.retryFailed && !props.loading && hasRetryableError ? (
            <button
              type="button"
              onClick={() => props.retryFailed?.()}
              className="rounded-md border border-slate-700/70 bg-transparent px-3 py-2 text-sm text-slate-300 hover:border-slate-600 hover:bg-slate-800/50 hover:text-white"
            >
              {tr("Retry")}
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
              title={tr("Error")}
              message={props.errorText}
              details={
                props.errorMeta
                  ? JSON.stringify(props.errorMeta, null, 2)
                  : undefined
              }
              hint={
                showPlaylistCopyHelp
                  ? undefined
                  : tr("If this looks stale, try a hard refresh.")
              }
            />
            {showPlaylistCopyHelp && (
              <aside
                className="mt-3 space-y-3 rounded-lg border border-white/20 bg-white/5 p-4 text-sm leading-6 text-slate-200"
                aria-label={tr("Try a personal copy")}
              >
                <h3 className="font-semibold text-white">
                  {tr("Official playlist unavailable? Try a personal copy.")}
                </h3>
                <ol className="list-decimal space-y-2 pl-5">
                  <li>
                    {tr(
                      "Open the original playlist in Spotify on your computer.",
                    )}
                  </li>
                  <li>
                    {tr(
                      "Add its tracks to a new public playlist you create in your own account.",
                    )}
                  </li>
                  <li>
                    {tr(
                      "Paste the new public playlist URL here and try again. No Spotify login is needed.",
                    )}
                  </li>
                </ol>
                <p>
                  {tr(
                    "Public playlists can be checked without Spotify login. Private playlists and some Spotify-generated playlists cannot be read this way.",
                  )}
                </p>
                <p className="text-slate-300">
                  {tr(
                    "The copy will not automatically follow updates to the original playlist. Spotify access restrictions still apply.",
                  )}
                </p>
              </aside>
            )}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => props.setForceRefreshHint(true)}
                className="text-xs px-2 py-1 rounded-md border border-slate-700 text-slate-300 hover:text-white"
              >
                {tr("Show refresh tips")}
              </button>
            </div>
          </div>
        ) : null}
      </form>
    </section>
  );
}
