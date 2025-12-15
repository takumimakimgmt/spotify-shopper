import { ApiPlaylistResponse } from '../types';
import { fetchJsonWithBase, getBackendUrl } from './client';

export async function getPlaylist(params: {
  url: string;
  source: 'spotify' | 'apple';
  refresh?: boolean;
  signal?: AbortSignal;
}): Promise<ApiPlaylistResponse> {
  const search = new URLSearchParams({ url: params.url, source: params.source });
  if (params.refresh) {
    search.set('refresh', '1');
  }
  return fetchJsonWithBase<ApiPlaylistResponse>(`/api/playlist?${search.toString()}`, {
    signal: params.signal,
  });
}

export async function postPlaylistWithRekordboxUpload(params: {
  url: string;
  source: 'spotify' | 'apple';
  file: File;
  refresh?: boolean;
  signal?: AbortSignal;
}): Promise<ApiPlaylistResponse> {
  const form = new FormData();
  form.append('url', params.url);
  form.append('source', params.source);
  form.append('file', params.file);
  form.append('rekordbox_xml', params.file);
  if (params.refresh) {
    form.append('refresh', '1');
  }

  return fetchJsonWithBase<ApiPlaylistResponse>('/api/playlist-with-rekordbox-upload', {
    method: 'POST',
    body: form,
    signal: params.signal,
  });
}

export async function matchSnapshotWithXml(snapshotJson: string, file: File): Promise<ApiPlaylistResponse> {
  const form = new FormData();
  form.append('snapshot', snapshotJson);
  form.append('file', file);

  const backend = getBackendUrl();
  if (!backend || backend === 'http://127.0.0.1:8000') {
    throw new Error('Backend URL が設定されていません。NEXT_PUBLIC_BACKEND_URL を確認してください。');
  }

  return fetchJsonWithBase<ApiPlaylistResponse>('/api/match-snapshot-with-xml', {
    method: 'POST',
    body: form,
  });
}
