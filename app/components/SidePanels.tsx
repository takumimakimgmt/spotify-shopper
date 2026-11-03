"use client";
import React, { useState, useRef } from "react";
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
  displayedTracks: _displayedTracks,
  // rekordboxFile,
  // rekordboxDate,
  applySnapshotWithXml,
  handleExportCSV,
}: SidePanelsProps) {
  const uploadRef = useRef<HTMLInputElement>(null);
  const [matching, setMatching] = useState(false);
  const [matchMessage, setMatchMessage] = useState<string | null>(null);
  const [xmlError, setXmlError] = useState<string | null>(null);
  const handleXmlChange: React.ChangeEventHandler<HTMLInputElement> = async (
    ev,
  ) => {
    const file = ev.target.files?.[0];
    if (!file || matching) return;
    if (file.size > MAX_XML_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      setXmlError(
        `XML is too large (${mb} MB). Maximum 3 MB. Choose a smaller export and check which library tracks it covers.`,
      );
      ev.target.value = "";
      return;
    }
    try {
      setMatching(true);
      setMatchMessage(null);
      setXmlError(null);
      await applySnapshotWithXml(file, currentResult, currentResult.tracks);
      setMatchMessage(`Checked all ${currentResult.tracks.length} tracks.`);
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setXmlError(`XML apply failed: ${errorMsg}`);
    } finally {
      setMatching(false);
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
            <input
              ref={uploadRef}
              type="file"
              accept=".xml"
              aria-label="Re-analyze all tracks with XML"
              className="hidden"
              onChange={handleXmlChange}
            />
            <button
              type="button"
              disabled={matching || currentResult.tracks.length === 0}
              onClick={() => uploadRef.current?.click()}
              className="min-h-9 rounded-md border border-white/15 px-3 py-2 text-slate-200 hover:border-white/30 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              {matching
                ? "Checking all tracks…"
                : "Re-analyze all tracks with XML"}
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="min-h-9 rounded-md border border-white/15 px-3 py-2 text-slate-200 hover:border-white/30 hover:text-white"
            >
              Export CSV
            </button>
          </div>
        </div>

        {matchMessage && (
          <p role="status" className="text-sm text-slate-300">
            {matchMessage}
          </p>
        )}
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
