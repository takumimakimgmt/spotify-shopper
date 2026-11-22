import type { PlaylistRow, TrackCategory } from "../types";

/** An automatic match is scoped to the selected XML, never global ownership. */
export function libraryMatchLabel(track: PlaylistRow): string {
  if (track.reviewDecision?.action === "owned") return "Confirmed by you";
  if (track.reviewDecision?.action === "different_version")
    return "Different version (you)";
  if (effectiveOwned(track) === true) return "Matches XML";
  if (effectiveOwned(track) === false) return "Not in XML";
  return libraryCheckState(track) === "review"
    ? "Needs review"
    : "Not checked — add XML";
}

export function libraryMatchExplanation(track: PlaylistRow): string {
  if (track.reviewDecision?.action === "owned")
    return "You confirmed ownership of this recording. Automatic XML evidence remains unchanged below.";
  if (track.reviewDecision?.action === "different_version")
    return "You marked this XML candidate as a different recording. Recheck before buying; this does not establish absence from your whole library.";
  if (hasConflictingEvidence(track))
    return "Saved matching evidence is inconsistent. Check again with the current XML before making a purchase decision.";
  if (effectiveOwned(track) === false)
    return "No matching recording was found in this XML. This does not rule out tracks outside the export or metadata differences.";
  if (effectiveOwned(track) === true) {
    const reason = track.libraryMatch?.reason ?? track.ownedReason;
    return reason === "isrc"
      ? "The recording identifier matched in this XML. Title or artist spelling may still differ."
      : reason === "exact"
        ? "Title, artist and version matched after normalization. Displayed text may still differ."
        : "A match was recorded in this XML. Check the comparison or check again for fresh evidence.";
  }
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
  return hasConflictingEvidence(track) ? null : (track.owned ?? null);
}
export function categorizeTrack(track: PlaylistRow): TrackCategory {
  const owned = effectiveOwned(track);
  return owned === true ? "owned" : owned === false ? "checkout" : "unknown";
}

/** Presentation state only: never changes recording matching or ownership evidence. */
export function libraryCheckState(
  track: PlaylistRow,
): "matched" | "absent" | "review" | "unchecked" {
  const owned = effectiveOwned(track);
  if (owned === true) return "matched";
  if (owned === false) return "absent";
  return hasConflictingEvidence(track) ||
    track.reviewDecision?.action === "different_version" ||
    track.libraryMatch?.status === "review" ||
    Boolean(track.ownedReason)
    ? "review"
    : "unchecked";
}

/** Fail closed for contradictory saved/transport evidence; preserve raw data for rechecking. */
export function hasConflictingEvidence(track: PlaylistRow): boolean {
  const status = track.libraryMatch?.status;
  const reasons = [track.ownedReason, track.libraryMatch?.reason].filter(
    Boolean,
  );
  const reviewReasons = [
    "version_mismatch",
    "artist_mismatch",
    "title_annotation_mismatch",
    "isrc_conflict",
    "album",
    "fuzzy",
  ];
  if (track.owned === true)
    return (
      (status != null && status !== "matched") ||
      reasons.some((r) => reviewReasons.includes(r!) || r === "no_match")
    );
  if (track.owned === false)
    return (
      status === "matched" ||
      status === "review" ||
      reasons.some(
        (r) => r === "isrc" || r === "exact" || reviewReasons.includes(r!),
      )
    );
  return status === "matched" || status === "not_found";
}
export function libraryStateHint(
  state: "matched" | "absent" | "review" | "unchecked",
) {
  return {
    matched:
      "Found in this XML or confirmed by you. Text differences can remain; open the evidence to see why.",
    absent:
      "No match in this XML. Check your library before buying; this is not proof that you do not own it.",
    review:
      "A similar track or conflicting evidence needs checking. Compare the version and artist before deciding.",
    unchecked:
      "These tracks have not been checked against XML. Add your rekordbox XML to check them.",
  }[state];
}
