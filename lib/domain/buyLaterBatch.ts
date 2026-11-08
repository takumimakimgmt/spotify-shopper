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
