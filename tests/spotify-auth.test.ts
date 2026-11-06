// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { GET as login } from "@/app/api/spotify/login/route";
import { GET as callback } from "@/app/api/spotify/callback/route";
import { GET as status } from "@/app/api/spotify/session/route";
import { POST as logout } from "@/app/api/spotify/logout/route";
import {
  readSession,
  seal,
  newFlow,
  SESSION_COOKIE,
  FLOW_COOKIE,
  SCOPES,
} from "@/lib/spotify/session";
import { authenticatedPlaylist } from "@/lib/spotify/playlist";
const origin = "https://www.playlistshopper.com";
const playlistId = "1111111111111111111111";
const trackId = "2222222222222222222222";
function request(
  path: string,
  cookie?: string,
  name = SESSION_COOKIE,
  method = "GET",
  sourceOrigin?: string,
) {
  return new NextRequest(origin + path, {
    method,
    headers: {
      ...(cookie ? { cookie: `${name}=${cookie}` } : {}),
      ...(sourceOrigin ? { origin: sourceOrigin } : {}),
    },
  });
}
function session(token = "opaque_test_token") {
  return seal({ accessToken: token, expiresAt: Date.now() + 60000 }, "session");
}
function flowRequest(state?: string) {
  const flow = newFlow();
  return request(
    `/api/spotify/callback?code=example&state=${state ?? flow.state}`,
    seal(flow, "flow"),
    FLOW_COOKIE,
  );
}
function track() {
  return {
    id: trackId,
    type: "track",
    name: "Song (Remix)",
    artists: [{ name: "Artist" }],
    album: { name: "Album" },
    external_ids: { isrc: "GBTEST1234567" },
  };
}
beforeEach(() => {
  vi.stubEnv("SPOTIFY_CLIENT_ID", "test-client");
  vi.stubEnv("SPOTIFY_REDIRECT_URI", origin + "/api/spotify/callback");
  vi.stubEnv("SPOTIFY_SESSION_SECRET", randomBytes(32).toString("hex"));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("Spotify OAuth boundary", () => {
  it("fails closed when configuration is missing", async () => {
    vi.stubEnv("SPOTIFY_SESSION_SECRET", "");
    expect((await login(request("/api/spotify/login"))).status).toBe(503);
    expect(
      await (await status(request("/api/spotify/session"))).json(),
    ).toEqual({ enabled: false, connected: false, expiresAt: null });
  });
  it("uses PKCE S256, state and secure HttpOnly cookies with minimal scopes", async () => {
    const res = await login(request("/api/spotify/login"));
    const url = new URL(res.headers.get("location")!);
    expect(url.origin).toBe("https://accounts.spotify.com");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe(SCOPES);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toHaveLength(43);
    expect(url.searchParams.get("state")!.length).toBeGreaterThan(32);
    expect(res.headers.get("set-cookie")).toContain("HttpOnly");
    expect(res.headers.get("set-cookie")).toContain("Secure");
    expect(res.headers.get("set-cookie")).toContain("SameSite=lax");
  });
  it("rejects altered state before exchanging a code", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const res = await callback(flowRequest("wrong-state"));
    expect(
      new URL(res.headers.get("location")!).searchParams.get("spotify_auth"),
    ).toBe("failed");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects expired transactions", async () => {
    const flow = newFlow();
    flow.expiresAt = Date.now() - 1;
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await callback(
      request(
        `/api/spotify/callback?code=example&state=${flow.state}`,
        seal(flow, "flow"),
        FLOW_COOKIE,
      ),
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("handles user denial without token exchange", async () => {
    const flow = newFlow();
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const res = await callback(
      request(
        `/api/spotify/callback?error=access_denied&state=${flow.state}`,
        seal(flow, "flow"),
        FLOW_COOKIE,
      ),
    );
    expect(res.headers.get("location")).toContain("cancelled");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("exchanges code with its verifier and returns no plaintext token or refresh token", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        access_token: "opaque_test_token",
        expires_in: 3600,
        scope: SCOPES,
        refresh_token: "ignored_refresh_value",
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    const res = await callback(flowRequest());
    expect(res.headers.get("location")).toBe(
      origin + "/?spotify_auth=connected",
    );
    expect(res.headers.get("set-cookie")).not.toContain("opaque_test_token");
    expect(res.headers.get("set-cookie")).not.toContain(
      "ignored_refresh_value",
    );
    const options = fetcher.mock.calls[0][1];
    expect(options.body.get("code_verifier").length).toBeGreaterThan(43);
    expect(options.body.has("client_secret")).toBe(false);
    const cookie = res.cookies.get(SESSION_COOKIE)!.value;
    const req = request("/api/spotify/session", cookie);
    expect(readSession(req)?.accessToken).toBe("opaque_test_token");
    const response = await status(req);
    expect(await response.json()).toMatchObject({ connected: true });
    expect(await (await status(req)).text()).not.toContain("opaque_test_token");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("rejects missing permissions and redacts token endpoint failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          access_token: "opaque_test_token",
          expires_in: 3600,
          scope: "user-read-email",
        }),
      ),
    );
    expect((await callback(flowRequest())).cookies.has(SESSION_COOKIE)).toBe(
      false,
    );
  });
  it("authenticates ciphertext and keeps flow/session purposes separate", () => {
    const cookie = session();
    expect(readSession(request("/", cookie.slice(0, -4) + "AAAA"))).toBeNull();
    expect(
      readSession(
        request(
          "/",
          seal(
            { accessToken: "opaque_test_token", expiresAt: Date.now() + 60000 },
            "flow",
          ),
        ),
      ),
    ).toBeNull();
    expect(
      readSession(
        request(
          "/",
          seal(
            { accessToken: "opaque_test_token", expiresAt: Date.now() - 1 },
            "session",
          ),
        ),
      ),
    ).toBeNull();
  });
  it("requires same-origin POST to clear both cookies", async () => {
    expect(
      (
        await logout(
          request(
            "/api/spotify/logout",
            session(),
            SESSION_COOKIE,
            "POST",
            "https://evil.test",
          ),
        )
      ).status,
    ).toBe(403);
    const res = await logout(
      request("/api/spotify/logout", session(), SESSION_COOKIE, "POST", origin),
    );
    expect(res.status).toBe(200);
    expect(res.cookies.get(SESSION_COOKIE)?.maxAge).toBe(0);
    expect(res.cookies.get(FLOW_COOKIE)?.maxAge).toBe(0);
  });
});
describe("authenticated playlist isolation", () => {
  it("keeps anonymous requests on the existing backend path", async () => {
    expect(
      await authenticatedPlaylist(request(`/api/playlist?url=${playlistId}`)),
    ).toBeNull();
  });
  it("does not silently fall back to app credentials after session expiry", async () => {
    const res = await authenticatedPlaylist(
      request(
        `/api/playlist?url=${playlistId}`,
        seal(
          { accessToken: "opaque_test_token", expiresAt: Date.now() - 1 },
          "session",
        ),
      ),
    );
    expect(res?.status).toBe(401);
    expect(await res?.json()).toEqual({ code: "SPOTIFY_LOGIN_EXPIRED" });
  });
  it("paginates using the current items endpoint and keeps ownership unknown", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ name: "Private list" }))
      .mockResolvedValueOnce(
        Response.json({
          items: [{ item: track() }],
          total: 2,
          next: "https://evil.test/never-follow",
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ items: [{ item: track() }], total: 2, next: null }),
      );
    vi.stubGlobal("fetch", fetcher);
    const res = await authenticatedPlaylist(
      request(`/api/playlist?url=${playlistId}`, session()),
    );
    const data = await res!.json();
    expect(data.tracks).toHaveLength(2);
    expect(data.tracks.every((t: { owned: unknown }) => t.owned === null)).toBe(
      true,
    );
    expect(fetcher.mock.calls[1][0]).toContain(`/items?limit=50&offset=0`);
    expect(fetcher.mock.calls[2][0]).toContain(`/items?limit=50&offset=1`);
    expect(res!.headers.get("cache-control")).toContain("private, no-store");
    expect(JSON.stringify(data)).not.toContain("opaque_test_token");
  });
  it("never returns partial results after a later page fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ name: "Private list" }))
        .mockResolvedValueOnce(
          Response.json({ items: [{ item: track() }], total: 2, next: "next" }),
        )
        .mockResolvedValueOnce(
          Response.json(
            { message: "private provider diagnostic" },
            { status: 403 },
          ),
        ),
    );
    const res = await authenticatedPlaylist(
      request(`/api/playlist?url=${playlistId}`, session()),
    );
    expect(res?.status).toBe(403);
    expect(await res?.json()).toEqual({ code: "SPOTIFY_ACCESS_RESTRICTED" });
  });
  it("uses separate per-request credentials without a shared cache", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(
        (url: string, options: { headers: { Authorization: string } }) =>
          Promise.resolve(
            Response.json(
              url.includes("/items?")
                ? { items: [], total: 0, next: null }
                : { name: options.headers.Authorization },
            ),
          ),
      );
    vi.stubGlobal("fetch", fetcher);
    await authenticatedPlaylist(
      request(`/api/playlist?url=${playlistId}`, session("first")),
    );
    await authenticatedPlaylist(
      request(`/api/playlist?url=${playlistId}`, session("second")),
    );
    expect(fetcher.mock.calls.map((c) => c[1].headers.Authorization)).toEqual([
      "Bearer first",
      "Bearer first",
      "Bearer second",
      "Bearer second",
    ]);
  });
  it("carries rate-limit timing and does not forward provider diagnostics", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { message: "provider internals" },
            { status: 429, headers: { "retry-after": "120" } },
          ),
        ),
    );
    const res = await authenticatedPlaylist(
      request(`/api/playlist?url=${playlistId}`, session()),
    );
    expect(res?.status).toBe(429);
    expect(res?.headers.get("retry-after")).toBe("120");
    expect(await res?.json()).toEqual({ code: "SPOTIFY_RATE_LIMITED" });
  });
  it("rejects URLs on unrelated hosts before contacting Spotify", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const res = await authenticatedPlaylist(
      request(
        `/api/playlist?url=${encodeURIComponent("https://evil.test/playlist/" + playlistId)}`,
        session(),
      ),
    );
    expect(res?.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
