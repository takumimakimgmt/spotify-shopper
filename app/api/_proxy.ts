import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function backendBaseUrl(): string {
  const base =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "";
  if (!base) throw new Error("BACKEND_URL (or NEXT_PUBLIC_BACKEND_URL) is not set");
  return base.replace(/\/+$/, "");
}

function withTimeout(ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, timer };
}

export async function proxyToBackend(req: NextRequest, endpoint: string) {
  const backend = backendBaseUrl();
  const incoming = new URL(req.url);

  const target = new URL(`${backend}/api/${endpoint}`);
  target.search = incoming.search;

  const { controller, timer } = withTimeout(120_000);

  try {
    const headers = new Headers(req.headers);
    headers.delete("host");
    headers.delete("connection");
    headers.delete("content-length");

    const init: RequestInit = {
      method: req.method,
      headers,
      signal: controller.signal,
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      init.body = await req.arrayBuffer();
    }

    const res = await fetch(target.toString(), init);

    const outHeaders = new Headers(res.headers);
    outHeaders.delete("content-encoding");

    return new NextResponse(res.body, { status: res.status, headers: outHeaders });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);

    return NextResponse.json(
      { error: "proxy_failed", message, endpoint, target: target.toString() },
      { status: 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
