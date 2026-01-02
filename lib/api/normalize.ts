import type { PlaylistRow } from "../types";

function stripNullsDeep(input: unknown): unknown {
  if (input === null || input === undefined) return undefined;
  if (Array.isArray(input)) return input.map(stripNullsDeep).filter((v) => v !== undefined);
  if (typeof input === "object") {
    const obj = input as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const vv = stripNullsDeep(v);
      if (vv !== undefined) out[k] = vv;
    }
    return out;
  }
  return input;
}

export function normalizeMeta(meta: unknown): Record<string, unknown> | undefined {
  return stripNullsDeep(meta) as Record<string, unknown> | undefined;
}

type TrackLike = {
  title: unknown;
  artist: unknown;
  album?: unknown;
  isrc?: unknown;
  spotify_url?: unknown;
  apple_url?: unknown;
  links?: unknown;
  owned?: unknown;
  owned_reason?: unknown;
  track_key_primary?: unknown;
  track_key_fallback?: unknown;
  track_key_primary_type?: unknown;
  track_key_version?: unknown;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function asBool(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}

function getLinks(v: unknown): { beatport: string; bandcamp: string; itunes: string } {
  if (!isRecord(v)) return { beatport: "", bandcamp: "", itunes: "" };
  return {
    beatport: asString(v.beatport) ?? "",
    bandcamp: asString(v.bandcamp) ?? "",
    itunes: asString(v.itunes) ?? "",
  };
}

function normalizeTrack(t: TrackLike, index: number): PlaylistRow {
  const links = isRecord(t.links) ? getLinks(t.links) : { beatport: "", bandcamp: "", itunes: "" };
  const primaryType = asString(t.track_key_primary_type) === "isrc" ? "isrc" : "norm";

  return {
    index,
    title: asString(t.title) ?? "",
    artist: asString(t.artist) ?? "",
    album: asString(t.album) ?? "",
    isrc: asString(t.isrc),
    spotifyUrl: asString(t.spotify_url) ?? "",
    appleUrl: asString(t.apple_url),
    stores: links,
    owned: asBool(t.owned) ?? false,
    ownedReason: asString(t.owned_reason),
    trackKeyPrimary: asString(t.track_key_primary),
    trackKeyFallback: asString(t.track_key_fallback),
    trackKeyPrimaryType: primaryType,
    trackKeyGuess: "",
  };
}

export function normalizeTracks(input: unknown): PlaylistRow[] {
  if (!isRecord(input)) return [];
  const tracks = input.tracks;
  if (!Array.isArray(tracks)) return [];

  return tracks
    .filter(isRecord)
    .map((t, idx) => normalizeTrack(t as unknown as TrackLike, idx + 1));
}
