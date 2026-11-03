import type { PlaylistRow } from "../types";

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
    { original: PlaylistRow; owned: boolean | null; reason: string | null }
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
    return { ...track, owned: update.owned, ownedReason: update.reason };
  });
}
