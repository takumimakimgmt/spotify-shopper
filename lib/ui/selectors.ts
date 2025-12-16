import type { PlaylistRow, TrackCategory } from '../types';
import { categorizeTrack } from '../state/usePlaylistAnalyzer';

export interface FilterOptions {
  categoryFilter: 'all' | 'toBuy' | 'owned';
  searchQuery: string;
  sortKey: 'none' | 'artist' | 'album' | 'title';
  onlyUnowned: boolean;
}

/**
 * Pure selector: compute displayedTracks from result + filters.
 * Single source of truth for derived track list.
 */
export function selectDisplayedTracks(
  tracks: PlaylistRow[],
  options: FilterOptions
): PlaylistRow[] {
  let filtered = tracks;

  // Filter by owned status when "only unowned" is toggled
  if (options.onlyUnowned) {
    filtered = filtered.filter((t) => t.owned !== true);
  }

  // Filter by search
  if (options.searchQuery.trim()) {
    const q = options.searchQuery.toLowerCase();
    filtered = filtered.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q)
    );
  }

  // Sort
  if (options.sortKey === 'artist') {
    filtered = [...filtered].sort((a, b) => a.artist.localeCompare(b.artist));
  } else if (options.sortKey === 'album') {
    filtered = [...filtered].sort((a, b) => a.album.localeCompare(b.album));
  } else if (options.sortKey === 'title') {
    filtered = [...filtered].sort((a, b) => a.title.localeCompare(b.title));
  }

  // Category filter
  if (options.categoryFilter === 'owned') {
    filtered = filtered.filter((t) => categorizeTrack(t) === 'owned');
  } else if (options.categoryFilter === 'toBuy') {
    filtered = filtered.filter((t) => categorizeTrack(t) === 'checkout');
  }

  return filtered;
}

/**
 * Pure selector: compute owned/toBuy counts from result.
 */
export function selectTrackCounts(tracks: PlaylistRow[]): {
  ownedCount: number;
  toBuyCount: number;
} {
  return {
    ownedCount: tracks.filter((t) => t.owned === true).length,
    toBuyCount: tracks.filter((t) => t.owned !== true).length,
  };
}

/**
 * Category labels mapping (UI constant).
 */
export const categoryLabels: Record<'all' | TrackCategory, string> = {
  all: 'All',
  checkout: 'To buy',
  owned: 'Owned',
};
