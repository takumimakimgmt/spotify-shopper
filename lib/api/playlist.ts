import { matchInBrowser, readLocalLibrary } from "../rekordbox/browserMatch";
import type { PlaylistSnapshotV1 } from "../types";
import type { PlaylistResponse } from "./schema";
import { PlaylistResponseSchema } from "./responseSchemas";
import { fetchJson, warmupBackend } from "./client";

export type PlaylistSource = "spotify";

export type GetPlaylistParams = {
  url: string;
  source?: "spotify"; // legacy placeholder (Apple will return via official API)
  appleMode?: "auto" | "fast" | "legacy"; // legacy (ignored)
  enrichSpotify?: boolean; // legacy (ignored)
  refresh?: boolean;
  market?: string;
  signal?: AbortSignal;
};

export type PostPlaylistWithRekordboxUploadParams = {
  file?: File;
  refresh?: boolean;
  url: string;
  rekordboxXmlPath?: string;
  source?: "spotify"; // legacy placeholder (Apple will return via official API)
  appleMode?: "auto" | "fast" | "legacy"; // legacy (ignored)
  enrichSpotify?: boolean; // legacy (ignored)
  signal?: AbortSignal;
};

export type MatchSnapshotTrack = Record<string, unknown>;
export type MatchSnapshotWithXmlResponse = {
  tracks?: MatchSnapshotTrack[];
  [key: string]: unknown;
};

const _DIRECT_BACKEND_ORIGIN = (
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  [
    ["https", "://"].join(""),
    ["spotify-shopper-backend", "onrender", "com"].join("."),
  ].join("")
).replace(/\/+$/, "");

function directApi(path: string): string {
  if (path.startsWith("http")) return path;
  // IMPORTANT: In the browser, keep /api/* same-origin to avoid CORS (Next API proxies server-side).
  if (path.startsWith("/api/")) return path;
  return path;
}

/**
 * New API (spotify-only)
 */
export async function fetchPlaylist(
  params: GetPlaylistParams,
): Promise<PlaylistResponse> {
  const search = new URLSearchParams();
  search.set("url", params.url);
  search.set("source", "spotify");
  if (params.market) search.set("market", params.market);
  if (params.refresh !== undefined)
    search.set("refresh", String(params.refresh));

  await warmupBackend(params.signal);
  return fetchJson<PlaylistResponse>(
    directApi(`/api/playlist?${search.toString()}`),
    { signal: params.signal },
    PlaylistResponseSchema,
  );
}

export async function fetchPlaylistWithRekordbox(
  params: PostPlaylistWithRekordboxUploadParams,
): Promise<PlaylistResponse> {
  if (!params.file)
    throw new Error("Choose a local XML file to match your library.");
  // Validate locally before requesting Spotify. No XML or library metadata leaves the browser.
  await readLocalLibrary(params.file, params.signal);
  const playlist = await fetchPlaylist(params);
  const { matches, meta } = await matchInBrowser(
    playlist.tracks,
    params.file,
    params.signal,
  );
  return {
    ...playlist,
    tracks: playlist.tracks.map((track, index) => ({
      ...track,
      ...matches[index],
    })),
    meta: {
      ...playlist.meta,
      ...meta,
      refresh: playlist.meta?.refresh ?? false,
    },
  };
}

/**
 * Legacy exports expected by usePlaylistAnalyzer.ts
 */
export async function getPlaylist(
  params: GetPlaylistParams,
): Promise<PlaylistResponse> {
  return fetchPlaylist(params);
}

export async function postPlaylistWithRekordboxUpload(
  params: PostPlaylistWithRekordboxUploadParams,
): Promise<PlaylistResponse> {
  return fetchPlaylistWithRekordbox(params);
}

/**
 * Legacy + new signature compatibility:
 * - matchSnapshotWithXml(JSON.stringify(snapshot), file)
 * - matchSnapshotWithXml({ snapshot, file, rekordboxXmlPath, signal })
 */
export function matchSnapshotWithXml(
  snapshotJson: string,
  file: File,
  signal?: AbortSignal,
): Promise<MatchSnapshotWithXmlResponse>;
export function matchSnapshotWithXml(params: {
  snapshot: PlaylistSnapshotV1;
  rekordboxXmlPath?: string;
  file?: File;
  signal?: AbortSignal;
}): Promise<MatchSnapshotWithXmlResponse>;
export async function matchSnapshotWithXml(
  a:
    | string
    | {
        snapshot: PlaylistSnapshotV1;
        rekordboxXmlPath?: string;
        file?: File;
        signal?: AbortSignal;
      },
  b?: File,
  c?: AbortSignal,
): Promise<MatchSnapshotWithXmlResponse> {
  let snapshot: PlaylistSnapshotV1;
  let file: File | undefined;
  let signal: AbortSignal | undefined;
  let rekordboxXmlPath: string | undefined;

  if (typeof a === "string") {
    const parsed = JSON.parse(a) as unknown;
    snapshot = parsed as PlaylistSnapshotV1;
    file = b;
    signal = c;
  } else {
    snapshot = a.snapshot;
    file = a.file;
    signal = a.signal;
    rekordboxXmlPath = a.rekordboxXmlPath;
  }

  if (!file || rekordboxXmlPath)
    throw new Error("Choose a local XML file. Server paths are not supported.");
  if (
    snapshot.schema !== "playlist_snapshot" ||
    snapshot.version !== 1 ||
    !Array.isArray(snapshot.tracks)
  )
    throw new Error("Invalid playlist snapshot.");
  const { matches, meta } = await matchInBrowser(snapshot.tracks, file, signal);
  return {
    ...snapshot,
    tracks: snapshot.tracks.map((track, index) => ({
      ...track,
      ...matches[index],
    })),
    meta,
  };
}
