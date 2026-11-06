export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { readSession } from "@/lib/spotify/session";
import { authenticatedPlaylist } from "@/lib/spotify/playlist";
import { proxyToBackend } from "../_proxy";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Public playlists use the same login-free path for every visitor.
  const response = await proxyToBackend(req, "playlist");
  if (![400, 403, 404].includes(response.status) || !readSession(req))
    return response;
  const failure = await response
    .clone()
    .json()
    .catch(() => null);
  const code = failure?.code ?? failure?.detail?.code;
  if (
    ![
      "SPOTIFY_ACCESS_RESTRICTED",
      "SPOTIFY_PLAYLIST_UNAVAILABLE",
      "SPOTIFY_PLAYLIST_RESTRICTED",
    ].includes(code)
  )
    return response;
  // Private / restricted playlists may be read with this visitor's valid session.
  return (await authenticatedPlaylist(req)) ?? response;
}

export async function POST(req: NextRequest) {
  return proxyToBackend(req, "playlist");
}
