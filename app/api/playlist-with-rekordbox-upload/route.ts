export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { proxyToBackend } from "../_proxy";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return proxyToBackend(req, "playlist-with-rekordbox-upload");
}

export async function POST(req: NextRequest) {
  return proxyToBackend(req, "playlist-with-rekordbox-upload");
}
