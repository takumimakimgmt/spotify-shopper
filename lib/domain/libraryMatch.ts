import type { PlaylistRow, TrackCategory } from "../types";

/** An automatic match is scoped to the selected XML, never global ownership. */
export function libraryMatchLabel(track: PlaylistRow): string {
  if (track.owned === true) return "Matches XML";
  if (track.owned === false) return "Not in XML";
  return track.ownedReason ? "Needs review" : "Not checked";
}

export function libraryMatchExplanation(track: PlaylistRow): string {
  switch (track.libraryMatch?.reason ?? track.ownedReason) {
    case "isrc":
      return "Recording identifier matches a track in this XML.";
    case "exact":
      return "Title, artist credits and recording details match a track in this XML.";
    case "artist_mismatch":
      return "Artist credits differ. Check the candidate recording.";
    case "title_annotation_mismatch":
      return "Title details differ. Check the candidate recording.";
    case "version_mismatch":
      return "A different mix or version was found. Check the recording before buying.";
    case "isrc_conflict":
      return "Recording identifiers differ. Check the candidate recording.";
    case "album":
      return "Title and album match, but the recording needs confirmation.";
    case "fuzzy":
      return "A similar title was found. Check the candidate recording.";
    default:
      return track.owned === false
        ? "No matching recording was found in this XML. You may own it outside this export."
        : track.owned === true
          ? "A matching recording was found in this XML."
          : "Choose XML to check this recording.";
  }
}

export function categorizeTrack(track: PlaylistRow): TrackCategory {
  return track.owned === true
    ? "owned"
    : track.owned === false
      ? "checkout"
      : "unknown";
}
