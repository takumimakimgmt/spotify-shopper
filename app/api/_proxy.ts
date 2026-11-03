import { NextRequest, NextResponse } from "next/server";
import net from "node:net";

type ErrorShape = {
  error: string;
  message: string;
  requestId: string;
  endpoint: string;
  upstreamStatus?: number;
  upstreamHost?: string;
  durationMs?: number;
  diagnostics?: Record<string, unknown>;
};

const OPEN_SPOTIFY_HOST = ["open", "spotify", "com"].join(".");
const SPOTIFY_PLAYLIST_ID_RE = /^[A-Za-z0-9]{22}$/;
const SPOTIFY_PLAYLIST_URI_RE = /^spotify:playlist:[A-Za-z0-9]{22}$/;
const INVALID_SPOTIFY_PLAYLIST_MESSAGE =
  "Enter a Spotify playlist URL, URI, or ID.";
const DEFAULT_MAX_PROXY_BODY_BYTES = 55 * 1024 * 1024;
const DEFAULT_MAX_PROXY_RESPONSE_BYTES = 25 * 1024 * 1024;
const MAX_RATE_LIMIT_BUCKETS = 10_000;
const RATE_LIMIT_PRUNE_INTERVAL = 256;
const PLAYLIST_URL_ENDPOINTS = new Set([
  "playlist",
  "playlist-with-rekordbox",
  "playlist-with-rekordbox-upload",
]);

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "expect",
]);

const STRIP_RESPONSE_HEADERS = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "set-cookie",
]);

function nowMs() {
  return Date.now();
}

function genRequestId(req: NextRequest): string {
  return (
    req.headers.get("x-request-id") ??
    globalThis.crypto?.randomUUID?.() ??
    `${nowMs()}-${Math.random().toString(16).slice(2)}`
  );
}

function diag(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    const out: Record<string, unknown> = {
      name: err.name,
      message: err.message,
    };
    const cause = (err as { cause?: unknown }).cause;
    if (cause && typeof cause === "object") {
      const c = cause as Record<string, unknown>;
      out.cause = {
        name: typeof c.name === "string" ? c.name : undefined,
        message: typeof c.message === "string" ? c.message : undefined,
        code:
          typeof c.code === "string"
            ? c.code
            : typeof c.code === "number"
              ? String(c.code)
              : undefined,
        errno: typeof c.errno === "number" ? c.errno : undefined,
        syscall: typeof c.syscall === "string" ? c.syscall : undefined,
        address: typeof c.address === "string" ? c.address : undefined,
        port: typeof c.port === "number" ? c.port : undefined,
      };
    }
    return out;
  }
  return { message: String(err) };
}

function stripWrappingQuotes(v: string): string {
  const s = v.trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1).trim();
  }
  return s;
}

function normalizeBackendUrl(raw: string | undefined): URL | null {
  if (!raw) return null;
  const cleaned = stripWrappingQuotes(raw);
  if (!cleaned) return null;

  let u: URL;
  try {
    u = new URL(cleaned);
  } catch {
    return null;
  }

  if (u.protocol !== "https:" && u.protocol !== "http:") return null;

  u.pathname = u.pathname.replace(/\/+$/, "");
  return u;
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((x) => Number(x));
  if (
    parts.length !== 4 ||
    parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)
  )
    return true;

  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 0) return true;
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const s = ip.toLowerCase();
  return (
    s === "::1" ||
    s.startsWith("fc") ||
    s.startsWith("fd") ||
    s.startsWith("fe80")
  );
}

function backendHostAllowed(u: URL): boolean {
  const host = u.hostname;
  const ipKind = net.isIP(host);
  if (ipKind === 4) return !isPrivateIpv4(host);
  if (ipKind === 6) return !isPrivateIpv6(host);
  return true;
}

function getAllowedBackendHosts(backend: URL): Set<string> {
  const env = process.env.BACKEND_HOST_ALLOWLIST;
  if (!env) return new Set([backend.hostname.toLowerCase()]);

  const s = env
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  return new Set(s.length ? s : [backend.hostname.toLowerCase()]);
}

function getBackendBaseUrl(): URL | null {
  const raw =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.API_BASE_URL;

  return normalizeBackendUrl(raw);
}

function isJsonLike(contentType: string | null): boolean {
  if (!contentType) return false;
  const ct = contentType.toLowerCase();
  return ct.includes("application/json") || ct.includes("+json");
}

function byteLimitFromEnv(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function boundedIntegerFromEnv(
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

function parseContentLength(headers: Headers): number | null {
  const raw = headers.get("content-length");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

async function readStreamWithLimit(
  stream: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<{ ok: true; bytes: Uint8Array<ArrayBuffer> } | { ok: false }> {
  if (!stream) {
    return { ok: true, bytes: new Uint8Array(new ArrayBuffer(0)) };
  }

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("payload_too_large").catch(() => {});
        return { ok: false };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(new ArrayBuffer(total));
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes };
}

function proxyJsonError(
  status: number,
  body: ErrorShape,
  extraHeaders?: Record<string, string>,
) {
  return NextResponse.json(body, {
    status,
    headers: { "x-request-id": body.requestId, ...extraHeaders },
  });
}

async function extractPlaylistUrlFromBody(
  req: NextRequest,
  bodyBytes: Uint8Array | undefined,
): Promise<{ ok: true; url: string | null } | { ok: false; message: string }> {
  if (!bodyBytes || bodyBytes.byteLength === 0) {
    return { ok: true, url: null };
  }

  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";

  try {
    if (contentType.includes("application/json")) {
      const data = JSON.parse(new TextDecoder().decode(bodyBytes)) as unknown;
      return {
        ok: true,
        url:
          typeof data === "object" &&
          data !== null &&
          typeof (data as Record<string, unknown>).url === "string"
            ? ((data as Record<string, unknown>).url as string)
            : null,
      };
    }

    if (contentType.includes("application/x-www-form-urlencoded")) {
      return {
        ok: true,
        url: new URLSearchParams(new TextDecoder().decode(bodyBytes)).get(
          "url",
        ),
      };
    }

    if (contentType.includes("multipart/form-data")) {
      const formBody = new ArrayBuffer(bodyBytes.byteLength);
      new Uint8Array(formBody).set(bodyBytes);
      const formReq = new Request(req.url, {
        method: req.method,
        headers: req.headers,
        body: formBody,
      });
      const form = await formReq.formData();
      const value = form.get("url");
      return { ok: true, url: typeof value === "string" ? value : null };
    }
  } catch {
    return { ok: false, message: "Invalid request body" };
  }

  return { ok: true, url: null };
}

function requiresPlaylistUrl(endpoint: string): boolean {
  return PLAYLIST_URL_ENDPOINTS.has(endpoint.replaceAll("_", "-"));
}

function getClientIp(req: NextRequest): string {
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const platformForwarded = req.headers.get("x-vercel-forwarded-for");
  if (platformForwarded) {
    return platformForwarded.split(",").at(-1)?.trim() || "unknown";
  }

  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",").at(-1)?.trim() || "unknown";
}

type Bucket = { resetAt: number; count: number };
const buckets = new Map<string, Bucket>();
let rateLimitChecks = 0;

function pruneRateLimitBuckets(now: number) {
  rateLimitChecks += 1;
  if (
    rateLimitChecks % RATE_LIMIT_PRUNE_INTERVAL !== 0 &&
    buckets.size < MAX_RATE_LIMIT_BUCKETS
  ) {
    return;
  }

  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }

  while (buckets.size >= MAX_RATE_LIMIT_BUCKETS) {
    const oldestKey = buckets.keys().next().value as string | undefined;
    if (!oldestKey) break;
    buckets.delete(oldestKey);
  }
}

function rateLimitKey(req: NextRequest, endpoint: string): string {
  return `${endpoint}:${getClientIp(req)}`;
}

function getRateLimitPerMinute(endpoint: string): number {
  const base = boundedIntegerFromEnv("RATE_LIMIT_PER_MINUTE", 120, 1, 10_000);
  const playlist = boundedIntegerFromEnv(
    "PLAYLIST_RATE_LIMIT_PER_MINUTE",
    30,
    1,
    10_000,
  );
  return requiresPlaylistUrl(endpoint) ? playlist : base;
}

function checkRateLimit(
  req: NextRequest,
  endpoint: string,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const limit = getRateLimitPerMinute(endpoint);
  const windowMs = 60_000;

  const key = rateLimitKey(req, endpoint);
  const t = nowMs();
  pruneRateLimitBuckets(t);
  const b = buckets.get(key);

  if (!b || t >= b.resetAt) {
    buckets.set(key, { resetAt: t + windowMs, count: 1 });
    return { ok: true };
  }

  if (b.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((b.resetAt - t) / 1000)),
    };
  }

  b.count += 1;
  return { ok: true };
}

type PlaylistUrlParamValidation = { ok: true } | { ok: false; message: string };

export function validateSpotifyPlaylistInput(
  raw: string | null,
): PlaylistUrlParamValidation {
  if (!raw) return { ok: false, message: INVALID_SPOTIFY_PLAYLIST_MESSAGE };
  if (raw.length > 2048) return { ok: false, message: "url is too long" };

  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, message: INVALID_SPOTIFY_PLAYLIST_MESSAGE };
  if (SPOTIFY_PLAYLIST_ID_RE.test(trimmed)) return { ok: true };
  if (SPOTIFY_PLAYLIST_URI_RE.test(trimmed)) return { ok: true };

  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return { ok: false, message: INVALID_SPOTIFY_PLAYLIST_MESSAGE };
  }

  if (u.protocol !== "https:" && u.protocol !== "http:") {
    return { ok: false, message: INVALID_SPOTIFY_PLAYLIST_MESSAGE };
  }

  const host = u.hostname.toLowerCase();
  if (host !== OPEN_SPOTIFY_HOST) {
    return { ok: false, message: INVALID_SPOTIFY_PLAYLIST_MESSAGE };
  }

  const [, type, id] = u.pathname.split("/");
  if (type !== "playlist" || !id || !SPOTIFY_PLAYLIST_ID_RE.test(id)) {
    return { ok: false, message: INVALID_SPOTIFY_PLAYLIST_MESSAGE };
  }

  return { ok: true };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function proxyToBackend(req: NextRequest, endpoint: string) {
  const requestId = genRequestId(req);
  const startedAt = nowMs();

  const rl = checkRateLimit(req, endpoint);
  if (!rl.ok) {
    const body: ErrorShape = {
      error: "rate_limited",
      message: "Too many requests",
      requestId,
      endpoint,
      durationMs: nowMs() - startedAt,
    };
    return proxyJsonError(429, body, {
      "retry-after": String(rl.retryAfterSec),
    });
  }

  const backend = getBackendBaseUrl();
  if (!backend) {
    return proxyJsonError(500, {
      error: "backend_url_missing",
      message:
        "Set BACKEND_URL (recommended) or NEXT_PUBLIC_BACKEND_URL / NEXT_PUBLIC_API_BASE_URL / API_BASE_URL.",
      requestId,
      endpoint,
      durationMs: nowMs() - startedAt,
    } satisfies ErrorShape);
  }

  if (!backendHostAllowed(backend)) {
    return proxyJsonError(500, {
      error: "backend_url_disallowed",
      message:
        "BACKEND_URL hostname is disallowed (private IP literal or invalid).",
      requestId,
      endpoint,
      upstreamHost: backend.hostname,
      durationMs: nowMs() - startedAt,
    } satisfies ErrorShape);
  }

  const allowedHosts = getAllowedBackendHosts(backend);
  if (!allowedHosts.has(backend.hostname.toLowerCase())) {
    return proxyJsonError(500, {
      error: "backend_url_disallowed",
      message: "BACKEND_URL hostname is not in BACKEND_HOST_ALLOWLIST.",
      requestId,
      endpoint,
      upstreamHost: backend.hostname,
      durationMs: nowMs() - startedAt,
    } satisfies ErrorShape);
  }

  const incomingUrl = new URL(req.url);
  const method = req.method.toUpperCase();

  const queryPlaylistUrl = incomingUrl.searchParams.get("url");
  if (queryPlaylistUrl !== null) {
    const v = validateSpotifyPlaylistInput(queryPlaylistUrl);
    if (!v.ok) {
      return proxyJsonError(400, {
        error: "invalid_input",
        message: v.message,
        requestId,
        endpoint,
        durationMs: nowMs() - startedAt,
      } satisfies ErrorShape);
    }
  }

  const maxBodyBytes = byteLimitFromEnv(
    "PROXY_MAX_BODY_BYTES",
    DEFAULT_MAX_PROXY_BODY_BYTES,
  );
  const requestContentLength = parseContentLength(req.headers);
  if (requestContentLength !== null && requestContentLength > maxBodyBytes) {
    return proxyJsonError(413, {
      error: "payload_too_large",
      message: "Request body is too large",
      requestId,
      endpoint,
      durationMs: nowMs() - startedAt,
    });
  }

  let bodyBytes: Uint8Array<ArrayBuffer> | undefined;
  if (method !== "GET" && method !== "HEAD") {
    const requestBody = await readStreamWithLimit(req.body, maxBodyBytes);
    if (!requestBody.ok) {
      return proxyJsonError(413, {
        error: "payload_too_large",
        message: "Request body is too large",
        requestId,
        endpoint,
        durationMs: nowMs() - startedAt,
      });
    }
    bodyBytes = requestBody.bytes;
  }

  if (bodyBytes && bodyBytes.byteLength > maxBodyBytes) {
    return proxyJsonError(413, {
      error: "payload_too_large",
      message: "Request body is too large",
      requestId,
      endpoint,
      durationMs: nowMs() - startedAt,
    });
  }

  const bodyPlaylistUrl = await extractPlaylistUrlFromBody(req, bodyBytes);
  if (!bodyPlaylistUrl.ok) {
    return proxyJsonError(400, {
      error: "invalid_input",
      message: bodyPlaylistUrl.message,
      requestId,
      endpoint,
      durationMs: nowMs() - startedAt,
    });
  }

  if (bodyPlaylistUrl.url !== null) {
    const v = validateSpotifyPlaylistInput(bodyPlaylistUrl.url);
    if (!v.ok) {
      return proxyJsonError(400, {
        error: "invalid_input",
        message: v.message,
        requestId,
        endpoint,
        durationMs: nowMs() - startedAt,
      });
    }
  }

  if (
    requiresPlaylistUrl(endpoint) &&
    queryPlaylistUrl === null &&
    bodyPlaylistUrl.url === null
  ) {
    return proxyJsonError(400, {
      error: "invalid_input",
      message: INVALID_SPOTIFY_PLAYLIST_MESSAGE,
      requestId,
      endpoint,
      durationMs: nowMs() - startedAt,
    });
  }

  const target = new URL(`/api/${endpoint}`, backend);
  incomingUrl.searchParams.forEach((value, key) =>
    target.searchParams.set(key, value),
  );

  const upstreamHeaders = new Headers(req.headers);
  for (const k of Array.from(upstreamHeaders.keys())) {
    if (HOP_BY_HOP.has(k.toLowerCase())) upstreamHeaders.delete(k);
  }
  upstreamHeaders.set("x-request-id", requestId);
  upstreamHeaders.delete("expect");
  upstreamHeaders.delete("x-backend-token");
  upstreamHeaders.set("accept-encoding", "identity");
  const backendProxyToken = process.env.BACKEND_PROXY_TOKEN?.trim();
  if (backendProxyToken) {
    upstreamHeaders.set("x-backend-token", backendProxyToken);
  }

  const maxAttempts = boundedIntegerFromEnv("PROXY_MAX_ATTEMPTS", 2, 1, 3);
  const timeoutMs = boundedIntegerFromEnv(
    "PROXY_TIMEOUT_MS",
    25_000,
    1_000,
    120_000,
  );
  const maxResponseBytes = byteLimitFromEnv(
    "PROXY_MAX_RESPONSE_BYTES",
    DEFAULT_MAX_PROXY_RESPONSE_BYTES,
  );
  const backoffMs = [0, 400, 900];

  for (let attempt = 1; attempt <= Math.max(1, maxAttempts); attempt++) {
    if (attempt > 1) await sleep(backoffMs[attempt - 1] ?? 500);

    const ac = new AbortController();
    const timer = setTimeout(
      () => ac.abort(new Error("upstream_timeout")),
      timeoutMs,
    );

    try {
      const t0 = nowMs();
      const res = await fetch(target.toString(), {
        method,
        headers: upstreamHeaders,
        body: bodyBytes?.buffer,
        signal: ac.signal,
        redirect: "follow",
        cache: "no-store",
      });

      const upstreamMs = nowMs() - t0;
      const status = res.status;
      const upstreamContentLength = parseContentLength(res.headers);
      if (
        upstreamContentLength !== null &&
        upstreamContentLength > maxResponseBytes
      ) {
        return proxyJsonError(502, {
          error: "upstream_response_too_large",
          message: "Upstream response is too large",
          requestId,
          endpoint,
          upstreamStatus: status,
          upstreamHost: backend.hostname,
          durationMs: nowMs() - startedAt,
        });
      }

      const upstreamBody = await readStreamWithLimit(
        res.body,
        maxResponseBytes,
      );
      if (!upstreamBody.ok) {
        return proxyJsonError(502, {
          error: "upstream_response_too_large",
          message: "Upstream response is too large",
          requestId,
          endpoint,
          upstreamStatus: status,
          upstreamHost: backend.hostname,
          durationMs: nowMs() - startedAt,
        });
      }
      const bytes = upstreamBody.bytes;

      if (status >= 500 && attempt < maxAttempts) continue;

      const outHeaders = new Headers(res.headers);
      for (const k of Array.from(outHeaders.keys())) {
        const lk = k.toLowerCase();
        if (HOP_BY_HOP.has(lk) || STRIP_RESPONSE_HEADERS.has(lk))
          outHeaders.delete(k);
      }

      if (isJsonLike(res.headers.get("content-type"))) {
        outHeaders.set("content-type", "application/json; charset=utf-8");
      }

      outHeaders.set("content-length", String(bytes.byteLength));
      outHeaders.set("x-request-id", requestId);
      outHeaders.set("x-proxy-backend-host", backend.hostname);
      outHeaders.set("x-upstream-status", String(status));
      outHeaders.set("x-upstream-ms", String(upstreamMs));

      return new Response(bytes.buffer, { status, headers: outHeaders });
    } catch (err) {
      if (attempt < maxAttempts) continue;

      return proxyJsonError(502, {
        error: "proxy_failed",
        message: "fetch failed",
        requestId,
        endpoint,
        upstreamHost: backend.hostname,
        durationMs: nowMs() - startedAt,
        diagnostics:
          process.env.PROXY_INCLUDE_DIAGNOSTICS === "true"
            ? diag(err)
            : undefined,
      } satisfies ErrorShape);
    } finally {
      clearTimeout(timer);
    }
  }

  return proxyJsonError(502, {
    error: "proxy_failed",
    message: "exhausted attempts",
    requestId,
    endpoint,
    upstreamHost: backend.hostname,
    durationMs: nowMs() - startedAt,
  } satisfies ErrorShape);
}
