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

function sleep(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
  });
}

function isRetryableStatus(status: number): boolean {
  return [429, 502, 503, 504].includes(status);
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const forwardAbort = () => controller.abort(init.signal?.reason);
  if (init.signal?.aborted) forwardAbort();
  else init.signal?.addEventListener("abort", forwardAbort, { once: true });
  const timer = setTimeout(
    () =>
      controller.abort(
        new DOMException("The operation timed out", "AbortError"),
      ),
    timeoutMs,
  );
  let rejectAbort: () => void = () => {};
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAbort = () => reject(controller.signal.reason);
    controller.signal.addEventListener("abort", rejectAbort, { once: true });
    if (controller.signal.aborted) rejectAbort();
  });
  try {
    const work = (async () => {
      const response = await fetch(url, { ...init, signal: controller.signal });
      // Keep timeout and caller cancellation active until the complete body arrives.
      const bytes = await response.arrayBuffer();
      return new Response(
        [204, 205, 304].includes(response.status) || init.method === "HEAD"
          ? null
          : bytes,
        {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        },
      );
    })();
    return await Promise.race([work, aborted]);
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener("abort", forwardAbort);
    controller.signal.removeEventListener("abort", rejectAbort);
  }
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  opts: { retries?: number; timeoutMs?: number } = {},
): Promise<Response> {
  // Uploads are not automatically repeated: a timed-out server may still be working.
  const safeMethod = ["GET", "HEAD"].includes(
    (init.method ?? "GET").toUpperCase(),
  );
  const retries = safeMethod ? (opts.retries ?? 1) : 0;
  const timeoutMs = opts.timeoutMs ?? 30000;
  for (let attempt = 0; ; attempt++) {
    let waitMs = 400 * 2 ** attempt + Math.floor(Math.random() * 250);
    try {
      const response = await fetchWithTimeout(url, init, timeoutMs);
      if (
        response.ok ||
        !isRetryableStatus(response.status) ||
        attempt >= retries
      )
        return response;
      const retryAfter = response.headers.get("retry-after");
      if (retryAfter) {
        const seconds = Number(retryAfter);
        const delay = Number.isFinite(seconds)
          ? seconds * 1000
          : Date.parse(retryAfter) - Date.now();
        if (delay > 30000) return response;
        if (Number.isFinite(delay)) waitMs = Math.max(waitMs, delay);
      }
    } catch (error) {
      if (init.signal?.aborted || attempt >= retries) throw error;
    }
    await sleep(Math.max(0, waitMs), init.signal);
  }
}

let lastWarmupSuccess = 0;
export async function warmupBackend(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw signal.reason;
  if (lastWarmupSuccess && Date.now() - lastWarmupSuccess < 60000) return;
  try {
    const response = await fetchWithTimeout(
      "/api/backend-health",
      { cache: "no-store", signal },
      3000,
    );
    if (response.ok) lastWarmupSuccess = Date.now();
  } catch (error) {
    if (signal?.aborted) throw error;
    // Warmup is best effort; normal requests retain their own deadlines.
  }
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
