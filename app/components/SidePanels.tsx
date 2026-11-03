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
  unknownCount: number;
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
  unknownCount,
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
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex flex-col gap-3 text-sm text-slate-400 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            {currentResult.rekordboxMeta && (
              <div className="truncate">
                XML: {currentResult.rekordboxMeta.filename ?? "—"}
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

          <div className="flex flex-wrap gap-1.5 lg:justify-end">
            {currentResult.playlistUrl && (
              <a
                href={currentResult.playlistUrl}
                target="_blank"
                rel="noreferrer"
                className="min-h-9 rounded-md border border-white/15 px-3 py-2 text-slate-200 hover:border-white/30 hover:text-white"
              >
                Open playlist
              </a>
            )}
            <label className="min-h-9 cursor-pointer rounded-md border border-white/15 px-3 py-2 text-slate-200 hover:border-white/30 hover:text-white">
              Re-analyze with XML
              <input
                type="file"
                accept=".xml"
                className="hidden"
                onChange={handleXmlChange}
              />
            </label>
            <button
              type="button"
              onClick={handleExportCSV}
              className="min-h-9 rounded-md border border-white/15 px-3 py-2 text-slate-200 hover:border-white/30 hover:text-white"
            >
              Export CSV
            </button>
          </div>
        </div>

        {xmlError && (
          <div>
            <ErrorAlert title="XML Error" message={xmlError} />
          </div>
        )}
      </div>
      <ResultSummaryBar
        result={currentResult}
        ownedCount={ownedCount}
        toBuyCount={toBuyCount}
        unknownCount={unknownCount}
      />
    </div>
  );
}

export default SidePanels;
