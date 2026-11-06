import { NextRequest, NextResponse } from "next/server";
import { readSession, spotifyConfig } from "@/lib/spotify/session";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const session = readSession(req);
  return NextResponse.json(
    {
      enabled: !!spotifyConfig(),
      connected: !!session,
      expiresAt: session?.expiresAt ?? null,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
