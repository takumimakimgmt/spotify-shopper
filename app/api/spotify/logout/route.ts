import { NextRequest, NextResponse } from "next/server";
import {
  spotifyConfig,
  setCookie,
  SESSION_COOKIE,
  FLOW_COOKIE,
} from "@/lib/spotify/session";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const config = spotifyConfig();
  if (!config || req.headers.get("origin") !== config.redirect.origin)
    return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 });
  const res = NextResponse.json({ connected: false });
  setCookie(res, SESSION_COOKIE, "", 0);
  setCookie(res, FLOW_COOKIE, "", 0);
  return res;
}
