import type { PlaylistRow, ResultState } from "../types";
import { recordingKey } from "./recordingIdentity";
import { effectiveOwned } from "./libraryMatch";

export type PurchasePlanEntry = {
  id: string;
  track: PlaylistRow;
  playlists: Array<{ url: string; title: string }>;
};
export function buildPurchasePlan(
  results: Array<[string, ResultState]>,
): PurchasePlanEntry[] {
  const groups = new Map<string, PurchasePlanEntry>();
  const unresolvedOrOwned = new Set(
    results.flatMap(([, result]) =>
      result.tracks
        .filter((track) => effectiveOwned(track) !== false)
        .map(recordingKey),
    ),
  );
  for (const [url, result] of results) {
    for (const track of result.tracks) {
      if (effectiveOwned(track) !== false) continue;
      const key = recordingKey(track);
      if (unresolvedOrOwned.has(key)) continue;
      let group = groups.get(key);
      if (!group) {
        group = { id: key, track, playlists: [] };
        groups.set(key, group);
      }
      const playlistKey = result.playlist_id || url;
      if (!group.playlists.some((p) => p.url === playlistKey))
        group.playlists.push({ url: playlistKey, title: result.title });
    }
  }
  return [...groups.values()].sort(
    (a, b) =>
      b.playlists.length - a.playlists.length ||
      a.track.title.localeCompare(b.track.title),
  );
}
