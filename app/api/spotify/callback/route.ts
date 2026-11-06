import { NextRequest, NextResponse } from "next/server";
import {
  spotifyConfig,
  readFlow,
  sameState,
  setCookie,
  seal,
  FLOW_COOKIE,
  SESSION_COOKIE,
  SCOPES,
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
  const finish = (status: string) => {
    const home = new URL("/", config.redirect);
    home.searchParams.set("spotify_auth", status);
    const res = NextResponse.redirect(home);
    setCookie(res, FLOW_COOKIE, "", 0);
    return res;
  };
  const flow = readFlow(req);
  const state = req.nextUrl.searchParams.get("state") || "";
  if (!flow || !sameState(state, flow.state)) return finish("failed");
  if (req.nextUrl.searchParams.has("error")) return finish("cancelled");
  const code = req.nextUrl.searchParams.get("code");
  if (!code || code.length > 2048) return finish("failed");
  try {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: config.clientId,
        redirect_uri: config.redirect.toString(),
        code,
        code_verifier: flow.verifier,
      }),
    });
    if (!response.ok) return finish("failed");
    const token = await response.json();
    if (
      typeof token.access_token !== "string" ||
      token.access_token.length === 0 ||
      token.access_token.length > 2400 ||
      typeof token.expires_in !== "number" ||
      !Number.isInteger(token.expires_in) ||
      token.expires_in <= 0 ||
      typeof token.scope !== "string" ||
      !SCOPES.split(" ").every((s) => token.scope.split(" ").includes(s))
    )
      return finish("failed");
    const seconds = Math.min(3600, Math.floor(token.expires_in));
    const res = finish("connected");
    setCookie(
      res,
      SESSION_COOKIE,
      seal(
        {
          accessToken: token.access_token,
          expiresAt: Date.now() + seconds * 1000,
        },
        "session",
      ),
      seconds,
    );
    return res;
  } catch {
    return finish("failed");
  }
}
