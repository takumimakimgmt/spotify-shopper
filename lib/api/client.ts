import type { ZodTypeAny } from "zod";
import { normalizeApiError } from "./errors";

export class SchemaMismatch extends Error {
  issues: unknown;
  constructor(message: string, issues: unknown) {
    super(message);
    this.name = "SchemaMismatch";
    this.issues = issues;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  opts: { retries?: number; timeoutMs?: number } = {},
): Promise<Response> {
  const retries = opts.retries ?? 4;
  const timeoutMs = opts.timeoutMs ?? 25000;

  let lastErr: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, init, timeoutMs);
      if (res.ok) return res;

      if (!isRetryableStatus(res.status) || attempt === retries) return res;

      const base = 400 * Math.pow(2, attempt);
      const jitter = Math.floor(Math.random() * 250);
      await sleep(base + jitter);
      continue;
    } catch (e) {
      lastErr = e;
      if (attempt === retries) throw e;

      const base = 400 * Math.pow(2, attempt);
      const jitter = Math.floor(Math.random() * 250);
      await sleep(base + jitter);
    }
  }

  throw lastErr ?? new Error("fetchWithRetry failed");
}

let warmupPromise: Promise<void> | null = null;

export function warmupBackend(): Promise<void> {
  if (warmupPromise) return warmupPromise;

  // Uses same base-building behavior as fetchJsonWithBase (below), because we call it via the same URL.
  warmupPromise = (async () => {
    try {
      const res = await fetchWithRetry(
        "/api/health",
        { cache: "no-store" },
        { retries: 6, timeoutMs: 15000 },
      );
      // Even 404 would be “backend reachable”, but we now expect 200.
      await res.text().catch(() => {});
    } catch {
      // swallow: warmup is best-effort
    }
  })();

  return warmupPromise;
}

const DEFAULT_BACKEND_ORIGIN = [
  ["https", "://"].join(""),
  ["spotify-shopper-backend", "onrender", "com"].join("."),
].join("");

function resolveApiUrl(path: string): string {
  if (path.startsWith("http")) return path;
  // In the browser, prefer same-origin Next.js API routes (/api/*).
  if (path.startsWith("/api/")) return path;
  if (!BASE_URL) return path;
  return path;
}

const BASE_URL = (
  process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_ORIGIN
).replace(/\/+$/, "");
export function getBackendUrl(): string {
  if (!BASE_URL) {
    throw new Error("NEXT_PUBLIC_BACKEND_URL environment variable is not set");
  }
  return BASE_URL;
}

export async function fetchJson<T>(
  path: string,
  init?: RequestInit,
  schema?: ZodTypeAny,
): Promise<T> {
  const url = resolveApiUrl(path);
  const res = await fetchWithRetry(url, init);
  const text = await res.text();
  let raw: unknown = {};
  try {
    raw = text ? (JSON.parse(text) as unknown) : {};
  } catch {
    raw = text;
  }
  if (!res.ok) {
    throw normalizeApiError({ status: res.status, data: raw });
  }
  if (!schema) return raw as T;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw normalizeApiError(
      new SchemaMismatch("API response schema mismatch", parsed.error.issues),
    );
  }
  return parsed.data as T;
}

export async function fetchJsonWithBase<T>(
  path: string,
  init?: RequestInit,
  schema?: ZodTypeAny,
): Promise<T> {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  return fetchJson<T>(url, init, schema);
}
