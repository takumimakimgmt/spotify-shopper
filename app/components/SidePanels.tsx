import React, { useState } from 'react';
import type { PlaylistRow, ResultState } from '../../lib/types';
import ResultSummaryBar from './ResultSummaryBar';
import ErrorAlert from './ErrorAlert';
import { MAX_XML_BYTES } from '@/lib/constants';

interface SidePanelsProps {
  currentResult: ResultState;
  ownedCount: number;
  toBuyCount: number;
  displayedTracks: PlaylistRow[];
  applySnapshotWithXml: (file: File, current: ResultState, displayedTracks: PlaylistRow[]) => Promise<void>;
  handleExportCSV: () => void;
}

export function SidePanels({
  currentResult,
  ownedCount,
  toBuyCount,
  displayedTracks,
  applySnapshotWithXml,
  handleExportCSV,
}: SidePanelsProps) {
  const [xmlError, setXmlError] = useState<string | null>(null);
  const handleXmlChange: React.ChangeEventHandler<HTMLInputElement> = async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_XML_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      setXmlError(`XML is too large (${mb} MB). Please export smaller, playlist-level XML from Rekordbox and try again.`);
      ev.target.value = '';
      return;
    }
    try {
      setXmlError(null);
      await applySnapshotWithXml(file, currentResult, displayedTracks);
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setXmlError(`XML apply failed: ${errorMsg}`);
    } finally {
      ev.target.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <ResultSummaryBar result={currentResult} ownedCount={ownedCount} toBuyCount={toBuyCount} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-semibold">
            {currentResult.title}{' '}
            {currentResult.playlistUrl && (
              <a
                href={currentResult.playlistUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-emerald-300 hover:underline ml-2"
              >
                Open
              </a>
            )}
          </h2>
          {xmlError && (
            <div className="mt-2">
              <ErrorAlert title="XML Error" message={xmlError} />
            </div>
          )}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:gap-2 sm:flex-wrap">
            <label className="px-3 py-1.5 rounded bg-slate-700 border border-slate-600 text-slate-200 text-xs font-medium cursor-pointer hover:bg-slate-600">
              Re-analyze with XML
              <input type="file" accept=".xml" className="hidden" onChange={handleXmlChange} />
            </label>
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded bg-slate-700 border border-slate-600 text-slate-200 text-xs font-medium hover:bg-slate-600"
            >
              Export as CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
