import type { PlaylistRow, TrackCategory } from "../types";

/** An automatic match is scoped to the selected XML, never global ownership. */
export function libraryMatchLabel(track: PlaylistRow): string {
  if (track.reviewDecision?.action === "owned") return "Confirmed by you";
  if (track.reviewDecision?.action === "different_version")
    return "Different version (you)";
  if (track.owned === true) return "Matches XML";
  if (track.owned === false) return "Not in XML";
  return track.ownedReason ? "Needs review" : "Not checked — add XML";
}

export function libraryMatchExplanation(track: PlaylistRow): string {
  if (track.reviewDecision?.action === "owned")
    return "You confirmed ownership of this recording. Automatic XML evidence remains unchanged below.";
  if (track.reviewDecision?.action === "different_version")
    return "You marked this XML candidate as a different recording. Recheck before buying; this does not establish absence from your whole library.";
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

export function effectiveOwned(track: PlaylistRow): boolean | null {
  if (track.reviewDecision?.action === "owned") return true;
  if (track.reviewDecision?.action === "different_version") return null;
  return track.owned ?? null;
}
export function categorizeTrack(track: PlaylistRow): TrackCategory {
  const owned = effectiveOwned(track);
  return owned === true ? "owned" : owned === false ? "checkout" : "unknown";
}
