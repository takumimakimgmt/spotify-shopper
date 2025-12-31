/**
 * useViewModel.ts
 * Returns ONLY derived data (displayedTracks, counts, etc.) based on analyzer + filters.
 * NO state setters, NO ref handling.
 * 
 * page.tsx calls hooks directly:
 * - const analyzer = usePlaylistAnalyzer()
 * - const filters = useFiltersState()
 * - const selection = useSelectionState()
 * - const vm = useViewModel(analyzer, filters)
 */
"use client";

import { useMemo } from "react";
import type { PlaylistRow, ResultState } from "../types";
import type { FiltersState } from "./useFiltersState";
import { usePlaylistAnalyzer } from "./usePlaylistAnalyzer";
import { selectDisplayedTracks, selectTrackCounts } from "../ui/selectors";

export interface ViewModel {
  // Derived data ONLY (memoized via selectors)
  displayedTracks: PlaylistRow[];
  ownedCount: number;
  toBuyCount: number;

  // Quick access to current result and all results (from analyzer)
  currentResult: ResultState | null;
  multiResults: Array<[string, ResultState]>;
  storageWarning: string | null;
  
  // Convenience booleans
  isEmpty: boolean;
  hasResults: boolean;
}

/**
 * Pure derived-data hook: takes analyzer + filters, returns computed view model.
 * No state mutations, no refs. Safe to use inside useMemo in page.tsx.
 */
export function useViewModel(
  analyzer: ReturnType<typeof usePlaylistAnalyzer>,
  filters: FiltersState,
  activeTab: string | null
): ViewModel {
  const multiResults = useMemo(
    () => analyzer.multiResults || [],
    [analyzer.multiResults]
  );

  const storageWarning = useMemo(
    () => analyzer.storageWarning || null,
    [analyzer.storageWarning]
  );

  // Compute currentResult from activeTab and multiResults
  const currentResult = useMemo(() => {
    if (!activeTab) return null;
    return multiResults.find(([url]) => url === activeTab)?.[1] ?? null;
  }, [activeTab, multiResults]);

  // Derive displayed tracks based on current result + filter options
  const displayedTracks = useMemo(() => {
    if (!currentResult) return [];
    return selectDisplayedTracks(currentResult.tracks, {
      categoryFilter: filters.categoryFilter,
      searchQuery: filters.searchQuery,
      sortKey: filters.sortKey,
    });
  }, [
    currentResult,
    filters.categoryFilter,
    filters.searchQuery,
    filters.sortKey,
  ]);

  // Derive counts
  const { ownedCount, toBuyCount } = useMemo(() => {
    if (!currentResult) return { ownedCount: 0, toBuyCount: 0 };
    return selectTrackCounts(currentResult.tracks);
  }, [currentResult]);

  const isEmpty = !currentResult;
  const hasResults = multiResults.length > 0;

  // Memoize entire view model to ensure stable reference
  const vm = useMemo<ViewModel>(
    () => ({
      displayedTracks,
      ownedCount,
      toBuyCount,
      currentResult,
      multiResults,
      storageWarning,
      isEmpty,
      hasResults,
    }),
    [
      displayedTracks,
      ownedCount,
      toBuyCount,
      currentResult,
      multiResults,
      storageWarning,
      isEmpty,
      hasResults,
    ]
  );

  return vm;
}
