import { NextRequest, NextResponse } from "next/server";
import {
  spotifyConfig,
  newFlow,
  challenge,
  SCOPES,
  FLOW_COOKIE,
  seal,
  setCookie,
} from "@/lib/spotify/session";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const config = spotifyConfig();
  if (!config)
    return NextResponse.json(
      { code: "SPOTIFY_AUTH_CONFIG" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  if (req.nextUrl.origin !== config.redirect.origin)
    return NextResponse.redirect(
      new URL("/api/spotify/login", config.redirect),
    );
  const flow = newFlow();
  const url = new URL("https://accounts.spotify.com/authorize");
  url.search = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: config.redirect.toString(),
    scope: SCOPES,
    state: flow.state,
    code_challenge_method: "S256",
    code_challenge: challenge(flow.verifier),
  }).toString();
  const res = NextResponse.redirect(url);
  setCookie(res, FLOW_COOKIE, seal(flow, "flow"), 600);
  return res;
}
