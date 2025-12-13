import { NextRequest, NextResponse } from "next/server";

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL ?? "";
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? "";

function notFound(message: string) {
  return NextResponse.json({ error: message }, { status: 404 });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return notFound("missing id");
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return NextResponse.json({ error: "Upstash env missing" }, { status: 500 });
  }

  const key = `share:${id}`;
  const resp = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    method: "GET",
  });
  if (!resp.ok) {
    const text = await resp.text();
    return NextResponse.json({ error: `Upstash error: ${text}` }, { status: 500 });
  }
  const json = await resp.json();
  const value = json?.result;
  if (!value) return notFound("not found or expired");
  try {
    const snapshot = JSON.parse(value);
    return NextResponse.json({ snapshot });
  } catch {
    return NextResponse.json({ error: "invalid stored JSON" }, { status: 500 });
  }
}
