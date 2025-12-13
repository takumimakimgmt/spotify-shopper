import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL ?? "";
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? "";

function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { snapshot, ttl_seconds } = body ?? {};
    if (!snapshot) return badRequest("snapshot is required");
    const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
    if (bytes.length > 1 * 1024 * 1024) return badRequest("snapshot too large (max 1MB)", 413);

    if (snapshot?.schema !== "playlist_snapshot" || snapshot?.version !== 1) {
      return badRequest("invalid snapshot schema/version");
    }

    const ttl = Math.min(Math.max(Number(ttl_seconds ?? 86400), 60), 7 * 24 * 3600);
    const id = randomUUID();
    const key = `share:${id}`;

    if (!UPSTASH_URL || !UPSTASH_TOKEN) {
      return badRequest("Upstash env missing: UPSTASH_REDIS_REST_URL/TOKEN");
    }

    const resp = await fetch(`${UPSTASH_URL}/setex/${encodeURIComponent(key)}/${ttl}/${encodeURIComponent(JSON.stringify(snapshot))}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      method: "POST",
    });
    if (!resp.ok) {
      const text = await resp.text();
      return badRequest(`Upstash error: ${text}`, 500);
    }

    const expires_at = new Date(Date.now() + ttl * 1000).toISOString();
    return NextResponse.json({ share_id: id, expires_at });
  } catch (e: any) {
    return badRequest(`failed: ${e?.message ?? e}`, 500);
  }
}
