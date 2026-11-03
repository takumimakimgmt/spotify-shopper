import { NextRequest } from "next/server";
import { proxyToBackend } from "../_proxy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  return proxyToBackend(request, "health");
}
