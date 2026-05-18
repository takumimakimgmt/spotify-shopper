"use client";

import React, { useMemo, useRef, useState } from "react";
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
  const [clipboardError, setClipboardError] = useState<string | null>(null);

  const messageFromMeta = useMemo(() => {
    const m = props.errorMeta?.message;
    return typeof m === "string" && m.trim() ? m : null;
  }, [props.errorMeta]);

  const playlistUrlError = useMemo(() => {
    const code = props.errorMeta?.error_code;
    if (code === "PLAYLIST_INVALID")
      return messageFromMeta ?? "Invalid playlist URL";
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
  const clearXml = () => {
    props.setRekordboxFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const replaceXml = () => {
    fileInputRef.current?.click();
  };

  const handlePasteFromClipboard = async () => {
    setClipboardError(null);
    if (!navigator.clipboard?.readText) {
      setClipboardError("Clipboard access blocked. Press ⌘V / Ctrl+V.");
      playlistInputRef.current?.focus();
      return;
    }

    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) {
        setClipboardError("Clipboard is empty. Press ⌘V / Ctrl+V.");
        playlistInputRef.current?.focus();
        return;
      }

      props.setPlaylistUrlInput(text);
      playlistInputRef.current?.focus();
    } catch {
      setClipboardError("Clipboard access blocked. Press ⌘V / Ctrl+V.");
      playlistInputRef.current?.focus();
    }
  };

  return (
    <section className="w-full max-w-4xl mx-auto p-4 space-y-4">
      {props.banner?.text ? (
        <div
          className={`rounded-lg p-3 text-sm ${
            props.banner.kind === "error"
              ? "bg-rose-950/50 border border-rose-800"
              : "bg-slate-900/50 border border-slate-800"
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
        <p className="text-sm leading-6 text-slate-300">
          Spotifyのプレイリストを、あなたのRekordboxライブラリと照合。
          <br />
          持っている曲を除いて、あとで買う曲だけを残せます。
        </p>

        <ol className="grid gap-2 rounded-md border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-300 sm:grid-cols-3">
          <li className="flex gap-2">
            <span className="font-semibold text-slate-100">1.</span>
            <span>Spotify URLを貼る</span>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-slate-100">2.</span>
            <span>XMLを使う / アップロードする</span>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-slate-100">3.</span>
            <span>To buyを見て、あとで買うに追加する</span>
          </li>
        </ol>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-200">
            Playlist URL(s)
          </label>
          <div className="flex items-start gap-2">
            <textarea
              ref={playlistInputRef}
              value={props.playlistUrlInput}
              onChange={(e) => props.setPlaylistUrlInput(e.target.value)}
              rows={3}
              placeholder="Spotify playlist URL"
              className={`w-full rounded-md bg-slate-900 border px-3 py-2 text-sm outline-none ${
                props.playlistUrlError || playlistUrlError
                  ? "border-rose-500/60"
                  : "border-slate-700"
              }`}
            />
            <button
              type="button"
              onClick={handlePasteFromClipboard}
              className="shrink-0 px-3 py-2 rounded-md border border-slate-700 text-sm text-slate-200 hover:text-white hover:bg-slate-800"
            >
              Paste
            </button>
          </div>
          <div className="text-xs text-slate-400">
            Paste a Spotify playlist URL
          </div>
          <details className="rounded-md border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-400">
            <summary className="cursor-pointer font-medium text-slate-300">
              Spotify URL の取り方
            </summary>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>Spotifyでプレイリストを開く</li>
              <li>共有メニューを開く</li>
              <li>リンクをコピーする</li>
            </ol>
          </details>
          {clipboardError ? (
            <div className="text-xs text-rose-300">{clipboardError}</div>
          ) : null}
          {props.playlistUrlError || playlistUrlError ? (
            <div className="text-xs text-rose-300">
              {props.playlistUrlError || playlistUrlError}
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-200">
            Rekordbox XML (optional)
          </label>
          <div className="text-xs text-slate-400">
            Optional — attach XML to mark tracks you already own
          </div>
          <details className="rounded-md border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-400">
            <summary className="cursor-pointer font-medium text-slate-300">
              Rekordbox XML の書き出し方
            </summary>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>rekordboxを開く</li>
              <li>File を開く</li>
              <li>Export Collection in xml format を選ぶ</li>
              <li>保存したXMLをここにアップロードする</li>
            </ol>
          </details>
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

          <div className="text-xs text-slate-400">
            使用中のXML: {props.rekordboxFilename ?? "none"}
            {props.rekordboxFilename && props.rekordboxDate
              ? ` · ${props.rekordboxDate}`
              : ""}
          </div>

          {localXmlError ? (
            <div className="text-xs text-rose-300">{localXmlError}</div>
          ) : null}

          <div className="rounded-md border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-400">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="font-medium text-slate-300">保存済みXML</div>
                {props.savedRekordboxXmlMeta ? (
                  <div>
                    {props.savedRekordboxXmlMeta.filename} ·{" "}
                    {formatBytes(props.savedRekordboxXmlMeta.size)}
                    <br />
                    Uploaded:{" "}
                    {formatDateTime(props.savedRekordboxXmlMeta.uploadedAt)}
                    <br />
                    Last modified:{" "}
                    {formatDateTime(props.savedRekordboxXmlMeta.lastModified)}
                  </div>
                ) : (
                  <div>No saved XML yet.</div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => props.useSavedRekordboxXml?.()}
                  disabled={
                    !props.savedRekordboxXmlMeta || props.savedRekordboxXmlBusy
                  }
                  className="px-2 py-1 rounded-md border border-slate-700 text-slate-300 hover:text-white disabled:opacity-40"
                >
                  保存済みを使う
                </button>
                <button
                  type="button"
                  onClick={replaceXml}
                  disabled={props.savedRekordboxXmlBusy}
                  className="px-2 py-1 rounded-md border border-slate-700 text-slate-300 hover:text-white disabled:opacity-40"
                >
                  入れ替える
                </button>
                <button
                  type="button"
                  onClick={() => props.forgetSavedRekordboxXml?.()}
                  disabled={
                    !props.savedRekordboxXmlMeta || props.savedRekordboxXmlBusy
                  }
                  className="px-2 py-1 rounded-md border border-slate-700 text-slate-300 hover:text-white disabled:opacity-40"
                >
                  保存済みを削除
                </button>
              </div>
            </div>
            {props.savedRekordboxXmlError ? (
              <div className="mt-2 text-rose-300">
                {props.savedRekordboxXmlError}
              </div>
            ) : null}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            className="rounded border-slate-700 bg-slate-900"
          />
          Unowned only
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={props.loading || !!localXmlError}
            className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40"
          >
            {props.isReanalyzing ? "Reanalyze" : "Analyze playlist"}
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

          <span className="text-xs text-slate-400">
            {props.rekordboxFile ? "Spotify + Rekordbox XML" : "Spotify only"}
          </span>
        </div>

        {props.loading ? (
          <div className="pt-2">
            <ProcessingBar
              analyzing={props.loading}
              reanalyzing={props.isReanalyzing}
              progress={props.progress}
            />
          </div>
        ) : null}

        {props.errorText ? (
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
