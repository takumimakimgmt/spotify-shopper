import { fetchJsonWithBase } from './client';

export type SharePayload = Record<string, unknown>;

export async function putShare(id: string, payload: SharePayload) {
  return fetchJsonWithBase<{ id: string }>(`/api/share/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getShare(id: string) {
  return fetchJsonWithBase<SharePayload>(`/api/share/${encodeURIComponent(id)}`);
}
