import type { PlaylistRow, ResultState } from "../types";
import { metadataKey, recordingKey } from "./recordingIdentity";

function sourceKey(track: PlaylistRow): string {
  const spotify = track.spotifyUrl?.match(
    /spotify\.com\/track\/([A-Za-z0-9]+)/,
  )?.[1];
  return spotify ? `spotify:${spotify}` : recordingKey(track);
}
export function withPlaylistChanges(
  result: ResultState,
  previous?: ResultState,
): ResultState {
  if (!previous)
    return {
      ...result,
      changeSummary: {
        hasPrevious: false,
        added: result.tracks.length,
        changed: 0,
        rechecked: 0,
        removed: 0,
        unchanged: 0,
      },
      tracks: result.tracks.map((t) => ({ ...t, changeStatus: "added" })),
    };
  const buckets = new Map<string, PlaylistRow[]>();
  previous.tracks.forEach((t) => {
    const key = sourceKey(t);
    buckets.set(key, [...(buckets.get(key) || []), t]);
  });
  const contextChanged =
    result.meta?.rekordbox?.library_sha256 !==
      previous.meta?.rekordbox?.library_sha256 ||
    result.meta?.ownership_rules_version !==
      previous.meta?.ownership_rules_version ||
    result.hasRekordboxData !== previous.hasRekordboxData;
  const counts = {
    hasPrevious: true,
    added: 0,
    changed: 0,
    rechecked: 0,
    removed: 0,
    unchanged: 0,
  };
  const tracks = result.tracks.map((t) => {
    const old = buckets.get(sourceKey(t))?.shift();
    const changeStatus = !old
      ? "added"
      : metadataKey(t) !== metadataKey(old)
        ? "changed"
        : contextChanged
          ? "rechecked"
          : "unchanged";
    counts[changeStatus]++;
    return { ...t, changeStatus } as PlaylistRow;
  });
  counts.removed = [...buckets.values()].reduce(
    (sum, rows) => sum + rows.length,
    0,
  );
  return { ...result, tracks, changeSummary: counts };
}
