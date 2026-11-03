import {
  normalizeArtist,
  normalizeTitle,
  normalizeAlbum,
  titleArtistPairs,
  artistIdentity,
  versionSignature,
  annotationSignature,
} from "./normalizer";
import { similarity } from "./similarity";
import type { LibraryMatch } from "../types";
export const LOCAL_RULES_VERSION = 4;
export type LibraryEntry = {
  title: string;
  artist: string;
  album: string;
  isrc?: string | null;
};
export type MatchInput = {
  title: string;
  artist: string;
  album?: string | null;
  isrc?: string | null;
};
export type LocalMatch = {
  owned: boolean | null;
  owned_reason: string | null;
  library_match: LibraryMatch;
};
const equal = (a: string[], b: string[]) =>
  JSON.stringify(a) === JSON.stringify(b);

export function matchLibrary(
  tracks: MatchInput[],
  library: LibraryEntry[],
  deadline = Date.now() + 20_000,
): LocalMatch[] {
  if (tracks.length > 10_000 || library.length > 100_000)
    throw new Error("Local matching exceeds safe track limits.");
  const byIsrc = new Map<string, LibraryEntry>();
  const byPair = new Map<string, LibraryEntry[]>();
  const byAlbum = new Map<string, LibraryEntry[]>();
  const byArtist = new Map<string, LibraryEntry[]>();
  const add = (
    map: Map<string, LibraryEntry[]>,
    key: string,
    entry: LibraryEntry,
  ) => {
    const entries = map.get(key) || [];
    entries.push(entry);
    map.set(key, entries);
  };
  for (const entry of library) {
    if (Date.now() > deadline)
      throw new Error("Local matching exceeded its time budget.");
    if (entry.isrc) byIsrc.set(entry.isrc.trim().toUpperCase(), entry);
    for (const key of titleArtistPairs(entry.title, entry.artist))
      add(byPair, key, entry);
    const artist = normalizeArtist(entry.artist),
      title = normalizeTitle(entry.title),
      album = normalizeAlbum(entry.album);
    if (artist) add(byArtist, artist, entry);
    if (title && album) add(byAlbum, JSON.stringify([title, album]), entry);
  }
  return tracks.map((track) => {
    if (Date.now() > deadline)
      throw new Error("Local matching exceeded its time budget.");
    let confirmed: { reason: string; candidate: LibraryEntry } | undefined;
    let review: { reason: string; candidate: LibraryEntry } | undefined;
    function compatible(candidate: LibraryEntry) {
      const requestedIsrc = (track.isrc || "").trim().toUpperCase(),
        candidateIsrc = (candidate.isrc || "").trim().toUpperCase();
      const reason =
        requestedIsrc && candidateIsrc && requestedIsrc !== candidateIsrc
          ? "isrc_conflict"
          : !equal(
                versionSignature(track.title),
                versionSignature(candidate.title),
              )
            ? "version_mismatch"
            : !equal(
                  annotationSignature(track.title),
                  annotationSignature(candidate.title),
                )
              ? "title_annotation_mismatch"
              : candidate.artist.trim() &&
                  !equal(
                    artistIdentity(track.artist),
                    artistIdentity(candidate.artist),
                  )
                ? "artist_mismatch"
                : null;
      if (reason) {
        review = { reason, candidate };
        return false;
      }
      return true;
    }
    const title = normalizeTitle(track.title),
      artist = normalizeArtist(track.artist),
      album = normalizeAlbum(track.album || "");
    const isrc = (track.isrc || "").trim().toUpperCase();
    if (isrc && byIsrc.has(isrc))
      confirmed = { reason: "isrc", candidate: byIsrc.get(isrc)! };
    if (!confirmed && title && artist)
      for (const key of titleArtistPairs(track.title, track.artist)) {
        // Evaluate all candidates, as the Python implementation does, before choosing the first compatible one.
        const candidates = (byPair.get(key) || []).filter(compatible);
        if (candidates.length) {
          confirmed = { reason: "exact", candidate: candidates[0] };
          break;
        }
      }
    if (!confirmed && title && album)
      for (const candidate of byAlbum.get(JSON.stringify([title, album])) ||
        []) {
        if (compatible(candidate)) {
          review = { reason: "album", candidate };
          break;
        }
      }
    if (!confirmed && title && artist) {
      let best = 0,
        candidate: LibraryEntry | undefined;
      for (const entry of byArtist.get(artist) || []) {
        if (Date.now() > deadline)
          throw new Error("Local matching exceeded its time budget.");
        const score = similarity(title, normalizeTitle(entry.title), deadline);
        if (score >= 0.92 && !compatible(entry)) continue;
        if (score > best) {
          best = score;
          candidate = entry;
        }
      }
      if (best >= 0.92 && candidate) review = { reason: "fuzzy", candidate };
    }
    const evidence = confirmed || review;
    const owned = confirmed ? true : review ? null : false;
    return {
      owned,
      owned_reason: evidence?.reason || null,
      library_match: {
        status: confirmed ? "matched" : review ? "review" : "not_found",
        reason: evidence?.reason || "no_match",
        matched_title: evidence?.candidate.title ?? null,
        matched_artist: evidence?.candidate.artist ?? null,
      },
    };
  });
}
