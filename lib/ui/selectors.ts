import type { PlaylistRow, TrackCategory } from '../types';
import { categorizeTrack } from '../state/usePlaylistAnalyzer';
import { buildSearchHaystack } from "@/lib/utils/normalize";
import { normalizeTitle, normalizeArtist } from '../utils/normalize';

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
  const safeTracks = Array.isArray(tracks) ? tracks : [];
  let filtered = safeTracks;

  // Filter by owned status when "only unowned" is toggled
  if (options.onlyUnowned) {
    filtered = filtered.filter((t) => t.owned !== true);
  }

  // Filter by search (normalized, haystack)
  if (options.searchQuery.trim()) {
    const q = buildSearchHaystack([options.searchQuery]);
    filtered = filtered.filter(
      (t) => {
        const hay = buildSearchHaystack([t.title, t.artist, t.album, t.label]);
        return hay.includes(q);
      }
    );
  }

  // Sort (normalized)
  if (options.sortKey === 'artist') {
    filtered = [...filtered].sort((a, b) => normalizeArtist(a.artist).localeCompare(normalizeArtist(b.artist)));
  } else if (options.sortKey === 'album') {
    filtered = [...filtered].sort((a, b) => (a.album ?? '').localeCompare(b.album ?? ''));
  } else if (options.sortKey === 'title') {
    filtered = [...filtered].sort((a, b) => normalizeTitle(a.title).localeCompare(normalizeTitle(b.title)));
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
  const safeTracks = Array.isArray(tracks) ? tracks : [];
  return {
    ownedCount: safeTracks.filter((t) => t.owned === true).length,
    toBuyCount: safeTracks.filter((t) => t.owned !== true).length,
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
