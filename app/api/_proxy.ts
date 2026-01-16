import { NextRequest, NextResponse } from "next/server";
import net from "node:net";
import { z } from "zod";

type ErrorShape = {
  error: string;
  message: string;
  requestId: string;
  endpoint: string;
  upstreamStatus?: number;
  upstreamHost?: string;
  durationMs?: number;
};

const OPEN_SPOTIFY_HOST = ["open", "spotify", "com"].join(".");

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

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

type Bucket = { resetAt: number; count: number };
const buckets = new Map<string, Bucket>();

function rateLimitKey(req: NextRequest, endpoint: string): string {
  return `${endpoint}:${getClientIp(req)}`;
}

function getRateLimitPerMinute(endpoint: string): number {
  const base = Number(process.env.RATE_LIMIT_PER_MINUTE ?? "120");
  const playlist = Number(process.env.PLAYLIST_RATE_LIMIT_PER_MINUTE ?? "30");
  if (endpoint === "playlist") return playlist;
  return Number.isFinite(base) && base > 0 ? base : 120;
}

function checkRateLimit(
  req: NextRequest,
  endpoint: string,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const limit = getRateLimitPerMinute(endpoint);
  const windowMs = 60_000;

  const key = rateLimitKey(req, endpoint);
  const t = nowMs();
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

// --- Gate-1 / FE-1: zod boundary validation for incoming query params ---
const PlaylistUrlParamSchema = z.string().trim().min(1).url();

type PlaylistUrlParamValidation = { ok: true } | { ok: false; message: string };

function validatePlaylistUrlParam(
  raw: string | null,
): PlaylistUrlParamValidation {
  const parsed = PlaylistUrlParamSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid url parameter" };
  }
  // keep existing domain/format rules in legacy validator
  return validatePlaylistUrlParamLegacy(parsed.data);
}

function validatePlaylistUrlParamLegacy(
  raw: string | null,
): { ok: true } | { ok: false; message: string } {
  if (!raw) return { ok: false, message: "Missing required query param: url" };
  if (raw.length > 2048) return { ok: false, message: "url is too long" };

  const trimmed = raw.trim();
  if (trimmed.startsWith("spotify:playlist:")) return { ok: true };

  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return { ok: false, message: "url must be a valid URL" };
  }

  if (u.protocol !== "https:" && u.protocol !== "http:") {
    return { ok: false, message: "url must be http/https" };
  }

  const host = u.hostname.toLowerCase();
  if (host !== OPEN_SPOTIFY_HOST) {
    const allowApple =
      (process.env.ALLOW_APPLE_MUSIC ?? "").toLowerCase() === "true";
    if (
      !(
        allowApple &&
        (host === "music.apple.com" || host === "itunes.apple.com")
      )
    ) {
      return { ok: false, message: "url host is not allowed" };
    }
  }

  if (host === OPEN_SPOTIFY_HOST) {
    const m = u.pathname.match(/^\/playlist\/[A-Za-z0-9]+/);
    if (!m) return { ok: false, message: "url must be a Spotify playlist URL" };
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
    return NextResponse.json(body, {
      status: 429,
      headers: {
        "x-request-id": requestId,
        "retry-after": String(rl.retryAfterSec),
      },
    });
  }

  const backend = getBackendBaseUrl();
  if (!backend) {
    return NextResponse.json(
      {
        error: "backend_url_missing",
        message:
          "Set BACKEND_URL (recommended) or NEXT_PUBLIC_BACKEND_URL / NEXT_PUBLIC_API_BASE_URL / API_BASE_URL.",
        requestId,
        endpoint,
        durationMs: nowMs() - startedAt,
      } satisfies ErrorShape,
      { status: 500, headers: { "x-request-id": requestId } },
    );
  }

  if (!backendHostAllowed(backend)) {
    return NextResponse.json(
      {
        error: "backend_url_disallowed",
        message:
          "BACKEND_URL hostname is disallowed (private IP literal or invalid).",
        requestId,
        endpoint,
        upstreamHost: backend.hostname,
        durationMs: nowMs() - startedAt,
      } satisfies ErrorShape,
      { status: 500, headers: { "x-request-id": requestId } },
    );
  }

  const allowedHosts = getAllowedBackendHosts(backend);
  if (!allowedHosts.has(backend.hostname.toLowerCase())) {
    return NextResponse.json(
      {
        error: "backend_url_disallowed",
        message: "BACKEND_URL hostname is not in BACKEND_HOST_ALLOWLIST.",
        requestId,
        endpoint,
        upstreamHost: backend.hostname,
        durationMs: nowMs() - startedAt,
      } satisfies ErrorShape,
      { status: 500, headers: { "x-request-id": requestId } },
    );
  }

  const incomingUrl = new URL(req.url);
  if (incomingUrl.searchParams.has("url")) {
    const v = validatePlaylistUrlParam(incomingUrl.searchParams.get("url"));
    if (!v.ok) {
      return NextResponse.json(
        {
          error: "invalid_input",
          message: v.message,
          requestId,
          endpoint,
          durationMs: nowMs() - startedAt,
        } satisfies ErrorShape,
        { status: 400, headers: { "x-request-id": requestId } },
      );
    }
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
  upstreamHeaders.set("accept-encoding", "identity");

  const method = req.method.toUpperCase();
  const bodyBytes =
    method === "GET" || method === "HEAD"
      ? undefined
      : new Uint8Array(await req.arrayBuffer());

  const maxAttempts = Number(process.env.PROXY_MAX_ATTEMPTS ?? "2");
  const timeoutMs = Number(process.env.PROXY_TIMEOUT_MS ?? "25000");
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
        body: bodyBytes,
        signal: ac.signal,
        redirect: "follow",
        cache: "no-store",
      });

      const upstreamMs = nowMs() - t0;
      const status = res.status;

      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);

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

      return new Response(bytes, { status, headers: outHeaders });
    } catch (err) {
      if (attempt < maxAttempts) continue;

      return NextResponse.json(
        {
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
        } as Record<string, unknown>,
        { status: 502, headers: { "x-request-id": requestId } },
      );
    } finally {
      clearTimeout(timer);
    }
  }

  return NextResponse.json(
    {
      error: "proxy_failed",
      message: "exhausted attempts",
      requestId,
      endpoint,
      upstreamHost: backend.hostname,
      durationMs: nowMs() - startedAt,
    } satisfies ErrorShape,
    { status: 502, headers: { "x-request-id": requestId } },
  );
}
