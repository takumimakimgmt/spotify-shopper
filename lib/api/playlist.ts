import type { PlaylistSnapshotV1 } from "../types";
import type { PlaylistResponse } from "./schema";

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

async function warmupBackend(): Promise<void> {
  // no-op (kept for compatibility)
}

const DIRECT_BACKEND_ORIGIN = (
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  [
    ["https", "://"].join(""),
    ["spotify-shopper-backend", "onrender", "com"].join("."),
  ].join("")
).replace(/\/+$/, "");

function directApi(path: string): string {
  if (path.startsWith("http")) return path;
  if (path.startsWith("/api/")) return `${DIRECT_BACKEND_ORIGIN}${path}`;
  return path;
}

async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(input, init);
  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  return text ? (JSON.parse(text) as T) : ({} as T);
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

  await warmupBackend();
  return fetchJson<PlaylistResponse>(
    directApi(`/api/playlist?${search.toString()}`),
    { signal: params.signal },
  );
}

export async function fetchPlaylistWithRekordbox(
  params: PostPlaylistWithRekordboxUploadParams,
): Promise<PlaylistResponse> {
  await warmupBackend();

  // file があるときだけ upload エンドポイント（multipart）
  if (params.file) {
    const form = new FormData();
    form.append("url", params.url);
    form.append("source", "spotify");
    if (params.rekordboxXmlPath)
      form.append("rekordbox_xml_path", params.rekordboxXmlPath);
    form.append("file", params.file);
    if (params.refresh) form.append("refresh", "1");

    return fetchJson<PlaylistResponse>(
      directApi(`/api/playlist-with-rekordbox-upload`),
      {
        method: "POST",
        body: form,
        signal: params.signal,
      },
    );
  }

  // file がないときは JSON エンドポイント（軽い・確実）
  return fetchJson<PlaylistResponse>(
    directApi(`/api/playlist-with-rekordbox`),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: params.url,
        source: "spotify",
        rekordbox_xml_path: params.rekordboxXmlPath,
        refresh: params.refresh,
      }),
      signal: params.signal,
    },
  );
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

  const form = new FormData();
  form.append("snapshot", JSON.stringify(snapshot));
  if (rekordboxXmlPath) form.append("rekordbox_xml_path", rekordboxXmlPath);
  if (file) form.append("file", file);

  await warmupBackend();
  return fetchJson<MatchSnapshotWithXmlResponse>(
    directApi(`/api/match-snapshot-with-xml`),
    {
      method: "POST",
      body: form,
      signal,
    },
  );
}
