import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const SESSION_COOKIE = "ps_spotify_session";
export const FLOW_COOKIE = "ps_spotify_flow";
export const SCOPES = "playlist-read-private playlist-read-collaborative";
const sessionSchema = z.object({
  accessToken: z.string().min(1).max(2400),
  expiresAt: z.number().finite(),
});
const flowSchema = z.object({
  state: z.string(),
  verifier: z.string(),
  expiresAt: z.number().finite(),
});
export type SpotifySession = z.infer<typeof sessionSchema>;

export function spotifyConfig() {
  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();
  const secret = process.env.SPOTIFY_SESSION_SECRET;
  try {
    const redirect = new URL(process.env.SPOTIFY_REDIRECT_URI || "");
    if (
      !clientId ||
      !secret ||
      secret.length < 32 ||
      redirect.username ||
      redirect.password ||
      redirect.search ||
      redirect.hash ||
      redirect.pathname !== "/api/spotify/callback"
    )
      return null;
    if (
      redirect.protocol !== "https:" &&
      !(
        redirect.protocol === "http:" &&
        ["127.0.0.1", "[::1]"].includes(redirect.hostname)
      )
    )
      return null;
    return { clientId, secret, redirect };
  } catch {
    return null;
  }
}

export function seal(value: unknown, purpose: "flow" | "session"): string {
  const config = spotifyConfig();
  if (!config) throw new Error("SPOTIFY_AUTH_CONFIG");
  const key = createHash("sha256").update(config.secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(
    Buffer.from(`playlist-shopper:spotify:${purpose}:${config.clientId}`),
  );
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value)),
    cipher.final(),
  ]);
  const cookie = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
  if (cookie.length > 3800) throw new Error("SPOTIFY_AUTH_CONFIG");
  return cookie;
}
function unseal(raw: string | undefined, purpose: "flow" | "session"): unknown {
  const config = spotifyConfig();
  if (!config || !raw || raw.length > 3800) return null;
  try {
    const bytes = Buffer.from(raw, "base64url");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      createHash("sha256").update(config.secret).digest(),
      bytes.subarray(0, 12),
    );
    decipher.setAuthTag(bytes.subarray(12, 28));
    decipher.setAAD(
      Buffer.from(`playlist-shopper:spotify:${purpose}:${config.clientId}`),
    );
    return JSON.parse(
      Buffer.concat([
        decipher.update(bytes.subarray(28)),
        decipher.final(),
      ]).toString(),
    );
  } catch {
    return null;
  }
}
export function readSession(req: NextRequest): SpotifySession | null {
  const parsed = sessionSchema.safeParse(
    unseal(req.cookies.get(SESSION_COOKIE)?.value, "session"),
  );
  return parsed.success && parsed.data.expiresAt > Date.now()
    ? parsed.data
    : null;
}
export function readFlow(req: NextRequest) {
  const parsed = flowSchema.safeParse(
    unseal(req.cookies.get(FLOW_COOKIE)?.value, "flow"),
  );
  return parsed.success && parsed.data.expiresAt > Date.now()
    ? parsed.data
    : null;
}
export function sameState(left: string, right: string) {
  const a = Buffer.from(left),
    b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function setCookie(
  res: NextResponse,
  name: string,
  value: string,
  maxAge: number,
) {
  res.cookies.set(name, value, {
    httpOnly: true,
    secure: spotifyConfig()?.redirect.protocol !== "http:",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
}
export function newFlow() {
  const verifier = randomBytes(48).toString("base64url");
  return {
    state: randomBytes(32).toString("base64url"),
    verifier,
    expiresAt: Date.now() + 600000,
  };
}
export function challenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}
