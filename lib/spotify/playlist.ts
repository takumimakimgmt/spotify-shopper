import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readSession, SESSION_COOKIE, setCookie } from "./session";

const item = z
  .object({
    id: z.string().nullable().optional(),
    type: z.string(),
    name: z.string(),
    is_local: z.boolean().optional(),
    artists: z.array(z.object({ name: z.string() })).optional(),
    album: z.object({ name: z.string() }).optional(),
    external_ids: z.object({ isrc: z.string().optional() }).optional(),
  })
  .passthrough();
const entry = z.object({
  item: item.nullable().optional(),
  track: item.nullable().optional(),
  is_local: z.boolean().optional(),
});
const pageSchema = z.object({
  items: z.array(entry),
  total: z.number().int().nonnegative(),
  next: z.string().nullable(),
});
class SpotifyReadError extends Error {
  constructor(
    public status: number,
    public code: string,
    public retryAfter?: string,
  ) {
    super(code);
  }
}
function playlistId(raw: string): string | null {
  if (/^[A-Za-z0-9]{22}$/.test(raw)) return raw;
  if (/^spotify:playlist:[A-Za-z0-9]{22}$/.test(raw)) return raw.split(":")[2];
  try {
    const url = new URL(raw);
    const match =
      /^\/(?:intl-[A-Za-z]{2}\/)?playlist\/([A-Za-z0-9]{22})\/?$/.exec(
        url.pathname,
      );
    return url.protocol === "https:" &&
      url.hostname === "open.spotify.com" &&
      !url.port &&
      !url.username &&
      !url.password &&
      match
      ? match[1]
      : null;
  } catch {
    return null;
  }
}
export async function authenticatedPlaylist(
  req: NextRequest,
): Promise<NextResponse | null> {
  const session = readSession(req);
  if (!session) {
    if (req.cookies.has(SESSION_COOKIE)) {
      const res = NextResponse.json(
        { code: "SPOTIFY_LOGIN_EXPIRED" },
        { status: 401, headers: { "Cache-Control": "private, no-store" } },
      );
      setCookie(res, SESSION_COOKIE, "", 0);
      return res;
    }
    return null;
  }
  const id = playlistId((req.nextUrl.searchParams.get("url") || "").trim());
  if (
    !id ||
    (req.nextUrl.searchParams.get("source") || "spotify") !== "spotify"
  )
    return NextResponse.json(
      { code: "PLAYLIST_INVALID" },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(22000)]);
  const read = async (path: string) => {
    const res = await fetch(`https://api.spotify.com/v1/${path}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: "no-store",
      redirect: "error",
      signal,
    });
    if (!res.ok) {
      const codes: Record<number, string> = {
        400: "SPOTIFY_PLAYLIST_RESTRICTED",
        401: "SPOTIFY_LOGIN_EXPIRED",
        403: "SPOTIFY_ACCESS_RESTRICTED",
        404: "SPOTIFY_PLAYLIST_UNAVAILABLE",
        429: "SPOTIFY_RATE_LIMITED",
      };
      const retry = res.headers.get("retry-after");
      throw new SpotifyReadError(
        codes[res.status] ? res.status : 502,
        codes[res.status] || "SPOTIFY_UNAVAILABLE",
        retry && /^\d+$/.test(retry)
          ? String(Math.min(86400, Math.max(1, Number(retry))))
          : undefined,
      );
    }
    // Do not forward provider response bodies or follow provider-supplied URLs.
    const text = await res.text();
    if (text.length > 2000000)
      throw new SpotifyReadError(502, "SPOTIFY_UNAVAILABLE");
    return JSON.parse(text);
  };
  try {
    const playlist = z
      .object({ name: z.string() })
      .parse(await read(`playlists/${id}?fields=name`));
    const tracks = [];
    let total = 0,
      skippedLocal = 0,
      skippedUnavailable = 0;
    let complete = false;
    for (let offset = 0; offset < 10000; ) {
      const page = pageSchema.parse(
        await read(`playlists/${id}/items?limit=50&offset=${offset}`),
      );
      total = page.total;
      if (total > 10000)
        throw new SpotifyReadError(422, "SPOTIFY_PLAYLIST_TOO_LARGE");
      for (const row of page.items) {
        const track = row.item ?? row.track;
        if (row.is_local || track?.is_local) {
          skippedLocal++;
          continue;
        }
        if (
          !track ||
          track.type !== "track" ||
          !track.id ||
          !/^[A-Za-z0-9]{22}$/.test(track.id)
        ) {
          skippedUnavailable++;
          continue;
        }
        tracks.push({
          title: track.name,
          artist: (track.artists || []).map((a) => a.name).join(", "),
          album: track.album?.name || "",
          isrc: track.external_ids?.isrc,
          spotify_url: `https://open.spotify.com/track/${track.id}`,
          links: {},
          owned: null,
        });
      }
      offset += page.items.length;
      if (!page.next) {
        if (offset < total)
          throw new SpotifyReadError(502, "SPOTIFY_UNAVAILABLE");
        complete = true;
        break;
      }
      if (!page.items.length)
        throw new SpotifyReadError(502, "SPOTIFY_UNAVAILABLE");
    }
    if (!complete)
      throw new SpotifyReadError(422, "SPOTIFY_PLAYLIST_TOO_LARGE");
    return NextResponse.json(
      {
        playlist_id: id,
        playlist_name: playlist.name,
        playlist_url: `https://open.spotify.com/playlist/${id}`,
        tracks,
        meta: {
          cache_hit: false,
          source_track_count: total,
          analyzed_track_count: tracks.length,
          skipped_local_count: skippedLocal,
          skipped_unavailable_count: skippedUnavailable,
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    const known =
      error instanceof SpotifyReadError
        ? error
        : new SpotifyReadError(502, "SPOTIFY_UNAVAILABLE");
    const headers: Record<string, string> = {
      "Cache-Control": "private, no-store",
    };
    if (known.retryAfter) headers["Retry-After"] = known.retryAfter;
    const res = NextResponse.json(
      { code: known.code },
      { status: known.status, headers },
    );
    if (known.status === 401) setCookie(res, SESSION_COOKIE, "", 0);
    return res;
  }
}
