// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const { proxy, authenticated, session } = vi.hoisted(() => ({
  proxy: vi.fn(),
  authenticated: vi.fn(),
  session: vi.fn(),
}));
vi.mock("@/app/api/_proxy", () => ({ proxyToBackend: proxy }));
vi.mock("@/lib/spotify/playlist", () => ({
  authenticatedPlaylist: authenticated,
}));
vi.mock("@/lib/spotify/session", () => ({ readSession: session }));
import { GET } from "@/app/api/playlist/route";
const req = () =>
  new NextRequest("https://www.playlistshopper.com/api/playlist?url=example", {
    headers: { cookie: "ps_spotify_session=expired" },
  });
beforeEach(() => {
  vi.resetAllMocks();
});
it("returns public playlists without a login, even with stale cookies", async () => {
  const response = NextResponse.json({ tracks: [] });
  proxy.mockResolvedValue(response);
  expect(await GET(req())).toBe(response);
  expect(session).not.toHaveBeenCalled();
  expect(authenticated).not.toHaveBeenCalled();
});
it("keeps public access failures actionable for anonymous visitors", async () => {
  const response = NextResponse.json(
    { detail: { code: "SPOTIFY_PLAYLIST_UNAVAILABLE" } },
    { status: 404 },
  );
  proxy.mockResolvedValue(response);
  session.mockReturnValue(null);
  expect(await GET(req())).toBe(response);
  expect(authenticated).not.toHaveBeenCalled();
});
it("tries the private path only after a classified denial and a valid session", async () => {
  proxy.mockResolvedValue(
    NextResponse.json(
      { detail: { code: "SPOTIFY_PLAYLIST_UNAVAILABLE" } },
      { status: 404 },
    ),
  );
  session.mockReturnValue({});
  const result = NextResponse.json({ tracks: [], private: true });
  authenticated.mockResolvedValue(result);
  expect(await GET(req())).toBe(result);
  expect(authenticated).toHaveBeenCalledTimes(1);
});
it("does not switch credentials on rate, server, or unclassified validation failures", async () => {
  for (const status of [400, 403, 429, 503]) {
    const response = NextResponse.json({ error: "other" }, { status });
    proxy.mockResolvedValue(response);
    session.mockReturnValue({});
    expect(await GET(req())).toBe(response);
  }
  expect(authenticated).not.toHaveBeenCalled();
});
