const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

export function getBackendUrl(): string {
  if (!BASE_URL) {
    throw new Error('NEXT_PUBLIC_BACKEND_URL environment variable is not set');
  }
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
