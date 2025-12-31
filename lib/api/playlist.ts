import type { ApiPlaylistResponse, PlaylistSnapshotV1 } from '../types';

export type PlaylistSource = 'spotify';

export type GetPlaylistParams = {
  refresh?: boolean;
  url: string;
  source?: 'spotify' | 'apple'; // legacy shape (apple ignored)
  appleMode?: 'auto' | 'fast' | 'legacy'; // legacy (ignored)
  enrichSpotify?: boolean; // legacy (ignored)
  market?: string;
  signal?: AbortSignal;
};

export type PostPlaylistWithRekordboxUploadParams = {
  refresh?: boolean;
  file?: File;
  url: string;
  rekordboxXmlPath?: string;
  source?: 'spotify' | 'apple'; // legacy (apple ignored)
  appleMode?: 'auto' | 'fast' | 'legacy'; // legacy (ignored)
  enrichSpotify?: boolean; // legacy (ignored)
  signal?: AbortSignal;
};

export type MatchSnapshotWithXmlParams = {
  snapshot: PlaylistSnapshotV1;
  rekordboxXmlPath: string;
  signal?: AbortSignal;
};

async function warmupBackend(): Promise<void> {
  // no-op (kept for compatibility with older code)
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `HTTP ${res.status}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

/**
 * New API (spotify-only)
 */
export async function fetchPlaylist(params: GetPlaylistParams): Promise<ApiPlaylistResponse> {
  const search = new URLSearchParams();
  search.set('url', params.url);
  search.set('source', 'spotify');
  if (params.market) search.set('market', params.market);

  await warmupBackend();
  return fetchJson<ApiPlaylistResponse>(`/api/playlist?${search.toString()}`, {
    signal: params.signal,
  });
}

export async function fetchPlaylistWithRekordbox(params: PostPlaylistWithRekordboxUploadParams): Promise<ApiPlaylistResponse> {
  const form = new FormData();
  form.append('url', params.url);
  if (params.rekordboxXmlPath) form.append('rekordbox_xml_path', params.rekordboxXmlPath);
  if (params.file) form.append('file', params.file);
  form.append('source', 'spotify');

  await warmupBackend();
  return fetchJson<ApiPlaylistResponse>(`/api/playlist_with_rekordbox`, {
    method: 'POST',
    body: form,
    signal: params.signal,
  });
}

/**
 * Legacy exports expected by usePlaylistAnalyzer.ts
 * Apple-related params are accepted but ignored (spotify-only).
 */
export async function getPlaylist(params: GetPlaylistParams): Promise<ApiPlaylistResponse> {
  return fetchPlaylist(params);
}

export async function postPlaylistWithRekordboxUpload(
  params: PostPlaylistWithRekordboxUploadParams
): Promise<ApiPlaylistResponse> {
  return fetchPlaylistWithRekordbox(params);
}

/**
 * Optional: only if your app actually calls this.
 * We keep it to satisfy imports; endpoint must exist in your Next API proxy.
 */
export function matchSnapshotWithXml(snapshotJson: string, file: File, signal?: AbortSignal): Promise<any>;
export function matchSnapshotWithXml(params: { snapshot: PlaylistSnapshotV1; rekordboxXmlPath?: string; file?: File; signal?: AbortSignal }): Promise<any>;
export async function matchSnapshotWithXml(
  a: string | { snapshot: PlaylistSnapshotV1; rekordboxXmlPath?: string; file?: File; signal?: AbortSignal },
  b?: File,
  c?: AbortSignal
): Promise<any> {
  let snapshot: PlaylistSnapshotV1;
  let file: File | undefined;
  let signal: AbortSignal | undefined;
  let rekordboxXmlPath: string | undefined;

  if (typeof a === 'string') {
    snapshot = JSON.parse(a) as PlaylistSnapshotV1;
    file = b;
    signal = c;
  } else {
    snapshot = a.snapshot;
    file = a.file;
    signal = a.signal;
    rekordboxXmlPath = a.rekordboxXmlPath;
  }

  const form = new FormData();
  form.append('snapshot', JSON.stringify(snapshot));
  if (rekordboxXmlPath) form.append('rekordbox_xml_path', rekordboxXmlPath);
  if (file) form.append('file', file);

  await warmupBackend();
  return fetchJson<any>(`/api/match_snapshot_with_xml`, {
    method: 'POST',
    body: form,
    signal,
  });
}
