const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://127.0.0.1:8000';

export function getBackendUrl(): string {
  return BASE_URL;
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const text = await res.text();
  const data = text ? (JSON.parse(text) as T) : ({} as T);
  if (!res.ok) {
    throw { status: res.status, data };
  }
  return data;
}

export async function fetchJsonWithBase<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  return fetchJson<T>(url, init);
}
