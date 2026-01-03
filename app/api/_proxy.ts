import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
function getBackendBaseUrl(): string | undefined {
  const raw =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.API_BASE_URL;

  return raw?.replace(/\/+$/, "");
}


function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function withTimeout(ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, timer };
}

function diag(e: unknown): Record<string, unknown> {
  if (!e || typeof e !== "object") return { message: String(e) };
  const err = e as { name?: string; message?: string; code?: unknown; cause?: unknown };
  const out: Record<string, unknown> = { name: err.name, message: err.message, code: err.code };
  const c = err.cause;
  if (c && typeof c === "object") {
    const cc = c as {
      name?: string;
      message?: string;
      code?: unknown;
      errno?: unknown;
      syscall?: unknown;
      address?: unknown;
      port?: unknown;
    };
    out.cause = {
      name: cc.name,
      message: cc.message,
      code: cc.code,
      errno: cc.errno,
      syscall: cc.syscall,
      address: cc.address,
      port: cc.port,
    };
  } else if (c !== undefined) {
    out.cause = c;
  }
  return out;
}

async function fetchOnce(req: NextRequest, target: string, signal: AbortSignal) {
  const headers = new Headers();
  headers.set("accept", req.headers.get("accept") ?? "application/json");
  // Do NOT forward accept-encoding; avoid compression/streaming edge cases.
  const ct = req.headers.get("content-type");
  if (ct) headers.set("content-type", ct);

  const init: RequestInit = { method: req.method, headers, signal };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }
  return fetch(target, init);
}

export async function proxyToBackend(req: NextRequest, endpoint: string) {
  const backend = getBackendBaseUrl();
  if (!backend) {
    return NextResponse.json(
      { error: "backend_url_missing", message: "Set BACKEND_URL (recommended) or NEXT_PUBLIC_BACKEND_URL." },
      { status: 500 },
    );
  }

  if (!backend) {
    return NextResponse.json(
      { error: "backend_url_missing", message: "Set BACKEND_URL (recommended) or NEXT_PUBLIC_BACKEND_URL." },
      { status: 500 },
    );
  }

  const incoming = new URL(req.url);

  const target = new URL(`${backend}/api/${endpoint}`);
  target.search = incoming.search;

  const { controller, timer } = withTimeout(120_000);

  try {
    let res: Response;
    try {
      res = await fetchOnce(req, target.toString(), controller.signal);
    } catch (e: unknown) {
      console.warn("[proxy] first attempt failed; retrying once:", diag(e));
      await sleep(300);
      res = await fetchOnce(req, target.toString(), controller.signal);
    }

    // IMPORTANT: Always buffer the entire response.
    // Vercel/streaming sometimes truncates mid-body even with 200.
    const buf = await res.arrayBuffer();

    const outHeaders = new Headers(res.headers);
    outHeaders.delete("content-encoding");
    outHeaders.delete("content-length");
    outHeaders.delete("transfer-encoding");

    // Helpful debug: confirm which backend was used
    outHeaders.set("x-proxy-backend", backend);

    return new NextResponse(buf, { status: res.status, headers: outHeaders });
  } catch (e: unknown) {
    const d = diag(e);
    console.error("[proxy] failed:", { endpoint, target: target.toString(), diag: d });
    return NextResponse.json(
      { error: "proxy_failed", endpoint, target: target.toString(), diagnostics: d },
      { status: 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
