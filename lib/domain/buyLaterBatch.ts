import type { PlaylistRow } from "../types";
import { recordingKey } from "./recordingIdentity";
import { effectiveOwned } from "./libraryMatch";
import { purchaseLinks } from "./purchaseLinks";
/** All filtered tracks, across pages. Never infer ownership from missing XML. */
export function buyLaterBatch(tracks: PlaylistRow[], queued: Set<string>) {
  const seen = new Set(queued);
  return tracks.flatMap((track) => {
    const id = recordingKey(track);
    if (effectiveOwned(track) !== false || seen.has(id)) return [];
    seen.add(id);
    const buyLink = purchaseLinks(track)[0];
    return [{ track, buyLink }];
  });
}

/** Explain the row count versus unique, unsaved purchase candidates. */
export function buyLaterBatchSummary(
  tracks: PlaylistRow[],
  queued: Set<string>,
) {
  const seen = new Set<string>();
  let duplicates = 0,
    saved = 0,
    excluded = 0;
  for (const track of tracks) {
    if (effectiveOwned(track) !== false) {
      excluded++;
      continue;
    }
    const id = recordingKey(track);
    if (seen.has(id)) {
      duplicates++;
      continue;
    }
    seen.add(id);
    if (queued.has(id)) saved++;
  }
  return { duplicates, saved, excluded };
}
