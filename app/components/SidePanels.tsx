import React from 'react';
import type { PlaylistRow, ResultState } from '../../lib/types';
import ResultSummaryBar from './ResultSummaryBar';

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
  const handleXmlChange: React.ChangeEventHandler<HTMLInputElement> = async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      await applySnapshotWithXml(file, currentResult, displayedTracks);
      alert('XML適用しました');
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      alert('XML適用失敗: ' + errorMsg);
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
