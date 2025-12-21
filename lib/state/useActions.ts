
"use client";
type SelectionLike = {
  activeTab: string | null;
  setActiveTab: (v: string | null) => void;
  setFormCollapsed: (v: boolean) => void;
};
/**
 * useActions.ts
 * Encapsulates all user-triggered operations (analyze, cancel, retry, etc.)
 * Used by page.tsx to invoke domain logic without mixing in UI concerns.
 */

import { useCallback } from "react";
import type { PlaylistRow, ResultState } from "../types";
import { usePlaylistAnalyzer } from "./usePlaylistAnalyzer";
import { normalizeStores } from "../playlist/stores";
import { sanitizeForCsvCell } from "../utils/csvSanitize";

export interface ActionsAPI {
  // Analyze operations
  handleAnalyze: (e: React.FormEvent) => void;
  cancelAnalyze: () => void;
  retryFailed: () => void;

  // Tab management
  handleRemoveTab: (urlToRemove: string) => void;
  handleClearAllTabs: () => void;

  // XML re-analyze
  triggerReAnalyzeFileInput: () => void;
  handleReAnalyzeFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  applySnapshotWithXml: (file: File, result: ResultState, tracks: PlaylistRow[]) => Promise<void>;

  // Export CSV
  generateCsv: (displayedTracks: PlaylistRow[], currentResult: ResultState | null) => string | null;
  downloadCsv: (displayedTracks: PlaylistRow[], currentResult: ResultState | null) => void;

  // Local data
  clearLocalData: () => void;
}

export function useActions(
  analyzer: ReturnType<typeof usePlaylistAnalyzer>,
  selection: SelectionLike
): ActionsAPI {
  const handleRemoveTab = useCallback(
    (urlToRemove: string) => {
      analyzer.setMultiResults((prev) => {
        const filtered = prev.filter(([url]) => url !== urlToRemove);
        if (selection.activeTab === urlToRemove) {
          const next = filtered[0]?.[0] ?? null;
          selection.setActiveTab(next);
          if (!next) selection.setFormCollapsed(false);
        }
        return filtered;
      });
    },
    [analyzer, selection]
  );

  const handleClearAllTabs = useCallback(() => {
    analyzer.setMultiResults([]);
    selection.setActiveTab(null);
    selection.setFormCollapsed(false);
  }, [analyzer, selection]);

  const triggerReAnalyzeFileInput = useCallback(() => {
    analyzer.reAnalyzeInputRef.current?.click();
  }, [analyzer.reAnalyzeInputRef]);

  const generateCsv = useCallback(
    (displayedTracks: PlaylistRow[], currentResult: ResultState | null): string | null => {
      if (!displayedTracks.length || !currentResult) {
        return null;
      }

      const headers = [
        "#",
        "Title",
        "Artist",
        "Album",
        "ISRC",
        "Owned",
        "Beatport",
        "Bandcamp",
        "iTunes",
      ];
      const rows = displayedTracks.map((t) => {
        const stores = normalizeStores(t.stores);
        return [
          sanitizeForCsvCell(String(t.index)),
          sanitizeForCsvCell(t.title),
          sanitizeForCsvCell(t.artist),
          sanitizeForCsvCell(t.album),
          sanitizeForCsvCell(t.isrc || ""),
          sanitizeForCsvCell(t.owned === true ? "Yes" : "No"),
          sanitizeForCsvCell(stores.beatport),
          sanitizeForCsvCell(stores.bandcamp),
          sanitizeForCsvCell(stores.itunes),
        ];
      });

      const csv = [headers, ...rows]
        .map((row) =>
          row
            .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
            .join(",")
        )
        .join("\n");

      return csv;
    },
    []
  );

  const downloadCsv = useCallback(
    (displayedTracks: PlaylistRow[], currentResult: ResultState | null) => {
      const csv = generateCsv(displayedTracks, currentResult);
      if (!csv) {
        alert("No tracks to export.");
        return;
      }

      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      const safePlaylistName = (currentResult?.title || "playlist")
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .substring(0, 50);
      a.download = `playlist_${safePlaylistName}_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [generateCsv]
  );

  const handleClearDataAndReset = useCallback(() => {
    analyzer.clearLocalData();
    selection.setActiveTab(null);
    selection.setFormCollapsed(false);
  }, [analyzer, selection]);

  return {
    handleAnalyze: analyzer.handleAnalyze,
    cancelAnalyze: analyzer.cancelAnalyze,
    retryFailed: analyzer.retryFailed,
    handleRemoveTab,
    handleClearAllTabs,
    triggerReAnalyzeFileInput,
    handleReAnalyzeFileChange: analyzer.handleReAnalyzeFileChange,
    applySnapshotWithXml: analyzer.applySnapshotWithXml,
    generateCsv,
    downloadCsv,
    clearLocalData: handleClearDataAndReset,
  };
}
