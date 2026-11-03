import { parseLibraryMatch } from "../api/normalize";
import type { PlaylistRow, PlaylistSnapshotV1, LibraryMatch } from "../types";

/** Match responses to submitted rows, never to lossy normalized music keys. */
export function applySnapshotOwnership(
  current: PlaylistRow[],
  submitted: PlaylistRow[],
  response: unknown,
): PlaylistRow[] {
  if (!Array.isArray(response) || response.length !== submitted.length) {
    throw new Error("Incomplete XML matching response. Please retry.");
  }
  const updates = new Map<
    number,
    {
      original: PlaylistRow;
      owned: boolean | null;
      reason: string | null;
      libraryMatch: LibraryMatch | null;
    }
  >();
  submitted.forEach((original, index) => {
    const matched = response[index];
    if (
      !matched ||
      typeof matched !== "object" ||
      matched.title !== original.title ||
      matched.artist !== original.artist ||
      (matched.album ?? "") !== (original.album ?? "") ||
      (matched.isrc ?? null) !== (original.isrc ?? null) ||
      (matched.owned != null && typeof matched.owned !== "boolean")
    ) {
      throw new Error(
        "XML matching response does not match the submitted tracks. Please retry.",
      );
    }
    updates.set(original.index, {
      original,
      libraryMatch: parseLibraryMatch(matched.library_match),
      owned: matched.owned ?? null,
      reason:
        typeof matched.owned_reason === "string" ? matched.owned_reason : null,
    });
  });
  return current.map((track) => {
    const update = updates.get(track.index);
    if (
      !update ||
      track.title !== update.original.title ||
      track.artist !== update.original.artist ||
      track.album !== update.original.album ||
      track.isrc !== update.original.isrc
    )
      return track;
    return {
      ...track,
      owned: update.owned,
      ownedReason: update.reason,
      libraryMatch: update.libraryMatch,
    };
  });
}

export function splitSnapshot(
  snapshot: PlaylistSnapshotV1,
): PlaylistSnapshotV1[] {
  const batches: PlaylistSnapshotV1[] = [];
  const overhead = new Blob([JSON.stringify({ ...snapshot, tracks: [] })]).size;
  let tracks: PlaylistSnapshotV1["tracks"] = [];
  let bytes = overhead;
  for (const track of snapshot.tracks) {
    const size = new Blob([JSON.stringify(track)]).size;
    if (overhead + size > 900_000)
      throw new Error("Track metadata is too large to re-analyze.");
    if (
      tracks.length >= 500 ||
      bytes + size + (tracks.length ? 1 : 0) > 900_000
    ) {
      batches.push({ ...snapshot, tracks });
      tracks = [];
      bytes = overhead;
    }
    bytes += size + (tracks.length ? 1 : 0);
    tracks.push(track);
  }
  if (tracks.length) batches.push({ ...snapshot, tracks });
  return batches;
}
