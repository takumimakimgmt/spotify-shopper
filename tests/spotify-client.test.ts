import { describe, expect, test, vi } from "vitest";

describe("spotify client config", () => {
  test("reads configured scopes from the client helper", async () => {
    const mod = await import("@/lib/spotify/client");
    expect(mod.getSpotifyAuthScopes()).toEqual([
      "playlist-read-private",
      "playlist-read-collaborative",
    ]);
  });

  test("reports auth as configured when client id is present", async () => {
    vi.stubEnv("NEXT_PUBLIC_SPOTIFY_CLIENT_ID", "spotify-client-id");
    const mod = await import("@/lib/spotify/client");
    expect(mod.isSpotifyAuthConfigured()).toBe(true);
    vi.unstubAllEnvs();
  });
});
