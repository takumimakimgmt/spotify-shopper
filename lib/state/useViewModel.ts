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

import {
  applyReviewDecisions,
  type ReviewDecisions,
} from "./useReviewDecisions";
import { useMemo } from "react";
import type { PlaylistRow, ResultState } from "../types";
import type { FiltersState } from "./useFiltersState";
import { usePlaylistAnalyzer } from "./usePlaylistAnalyzer";
import { selectDisplayedTracks, selectTrackCounts } from "../ui/selectors";

const EMPTY_DECISIONS: ReviewDecisions = {};

export interface ViewModel {
  // Derived data ONLY (memoized via selectors)
  displayedTracks: PlaylistRow[];
  ownedCount: number;
  toBuyCount: number;
  unknownCount: number;

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
  selectedKey: string | null,
  decisions: ReviewDecisions = EMPTY_DECISIONS,
): ViewModel {
  const multiResults = useMemo(
    () =>
      (analyzer.multiResults || []).map(
        ([url, result]): [string, ResultState] => [
          url,
          {
            ...result,
            tracks: applyReviewDecisions(
              result.tracks,
              decisions,
              result.meta?.rekordbox?.library_sha256,
              result.meta?.ownership_rules_version,
            ),
          },
        ],
      ),
    [analyzer.multiResults, decisions],
  );

  const storageWarning = useMemo(
    () => analyzer.storageWarning || null,
    [analyzer.storageWarning],
  );

  // Compute currentResult from selectedKey and multiResults
  const currentResult = useMemo(() => {
    if (!selectedKey) return null;
    return multiResults.find(([url]) => url === selectedKey)?.[1] ?? null;
  }, [selectedKey, multiResults]);

  // Derive displayed tracks based on current result + filter options
  const displayedTracks = useMemo(() => {
    if (!currentResult) return [];
    return selectDisplayedTracks(currentResult.tracks, {
      changesOnly:
        !!currentResult.changeSummary?.hasPrevious && filters.changesOnly,
      categoryFilter: filters.categoryFilter,
      searchQuery: filters.searchQuery,
      sortKey: filters.sortKey,
    });
  }, [
    currentResult,
    filters.changesOnly,
    filters.categoryFilter,
    filters.searchQuery,
    filters.sortKey,
  ]);

  // Derive counts
  const { ownedCount, toBuyCount, unknownCount } = useMemo(() => {
    if (!currentResult)
      return { ownedCount: 0, toBuyCount: 0, unknownCount: 0 };
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
      unknownCount,
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
      unknownCount,
      currentResult,
      multiResults,
      storageWarning,
      isEmpty,
      hasResults,
    ],
  );

  return vm;
}
