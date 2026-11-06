export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { authenticatedPlaylist } from "@/lib/spotify/playlist";
import { proxyToBackend } from "../_proxy";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return (await authenticatedPlaylist(req)) ?? proxyToBackend(req, "playlist");
}

export async function POST(req: NextRequest) {
  return proxyToBackend(req, "playlist");
}
