import { NextRequest } from "next/server";
import { proxyToBackend } from "../_proxy";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return proxyToBackend(req, "match_snapshot_with_xml");
}

export async function POST(req: NextRequest) {
  return proxyToBackend(req, "match_snapshot_with_xml");
}
