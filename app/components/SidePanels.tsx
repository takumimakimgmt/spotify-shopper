"use client";
import React, { useState } from "react";
import type { PlaylistRow, ResultState } from "../../lib/types";
import ResultSummaryBar from "./ResultSummaryBar";
import ErrorAlert from "./ErrorAlert";
import { MAX_XML_BYTES } from "@/lib/constants";

interface SidePanelsProps {
  currentResult: ResultState;
  ownedCount: number;
  toBuyCount: number;
  displayedTracks: PlaylistRow[];
  rekordboxFile: File | null;
  rekordboxDate?: string | null;
  applySnapshotWithXml: (
    file: File,
    current: ResultState,
    displayedTracks: PlaylistRow[],
  ) => Promise<void>;
  handleExportCSV: () => void;
}

export function SidePanels({
  currentResult,
  ownedCount,
  toBuyCount,
  displayedTracks,
  // rekordboxFile,
  // rekordboxDate,
  applySnapshotWithXml,
  handleExportCSV,
}: SidePanelsProps) {
  const [xmlError, setXmlError] = useState<string | null>(null);
  const handleXmlChange: React.ChangeEventHandler<HTMLInputElement> = async (
    ev,
  ) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_XML_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      setXmlError(
        `XML is too large (${mb} MB). Please export smaller, playlist-level XML from Rekordbox and try again.`,
      );
      ev.target.value = "";
      return;
    }
    try {
      setXmlError(null);
      await applySnapshotWithXml(file, currentResult, displayedTracks);
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setXmlError(`XML apply failed: ${errorMsg}`);
    } finally {
      ev.target.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <ResultSummaryBar
        result={currentResult}
        ownedCount={ownedCount}
        toBuyCount={toBuyCount}
      />
      <div className="rounded-xl border border-slate-800 bg-slate-900/55 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-100">
                {currentResult.title}
              </h2>
              {currentResult.playlistUrl && (
                <a
                  href={currentResult.playlistUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-slate-700 px-2.5 py-1 text-[11px] text-emerald-300 hover:border-emerald-400/40 hover:text-emerald-200"
                >
                  Open playlist
                </a>
              )}
            </div>

            <div className="text-sm text-slate-300">
              Focus the shortlist first, then use XML re-check or export when
              you are ready to act.
            </div>

            {currentResult.rekordboxMeta && (
              <div className="text-xs text-slate-400">
                Last XML: {currentResult.rekordboxMeta.filename ?? "—"}
                <span className="ml-2">
                  Updated:{" "}
                  {currentResult.rekordboxMeta.updatedAtISO
                    ? new Date(
                        currentResult.rekordboxMeta.updatedAtISO,
                      ).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
                    : "—"}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
            <label className="cursor-pointer rounded bg-emerald-600 px-3 py-2 text-xs font-medium text-slate-950 hover:bg-emerald-500">
              Re-analyze with XML
              <input
                type="file"
                accept=".xml"
                className="hidden"
                onChange={handleXmlChange}
              />
            </label>
            <button
              onClick={handleExportCSV}
              className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
            >
              Export as CSV
            </button>
          </div>
        </div>

        {xmlError && (
          <div className="mt-4">
            <ErrorAlert title="XML Error" message={xmlError} />
          </div>
        )}
      </div>
    </div>
  );
}

export default SidePanels;
