import type { PlaylistRow } from "../types";

function text(value: string | undefined): string {
  return (value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[—–−―]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}
/** Never use the lossy title/primary-artist lookup keys for human decisions or grouping. */
export function recordingKey(
  track: Pick<PlaylistRow, "title" | "artist"> &
    Partial<Pick<PlaylistRow, "album" | "isrc" | "spotifyUrl">>,
): string {
  const isrc = track.isrc?.trim().toUpperCase() || "";
  const spotify =
    track.spotifyUrl?.match(/spotify\.com\/track\/([A-Za-z0-9]+)/)?.[1] || "";
  return JSON.stringify([
    "recording-v1",
    isrc || spotify,
    text(track.title),
    text(track.artist),
    isrc || spotify ? "" : text(track.album),
  ]);
}
export function metadataKey(track: PlaylistRow): string {
  return JSON.stringify([
    recordingKey(track),
    track.title,
    track.artist,
    track.album,
    track.isrc || "",
    track.spotifyUrl || "",
  ]);
}
