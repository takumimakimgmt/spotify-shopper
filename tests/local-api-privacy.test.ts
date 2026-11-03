import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const { localMatch, readLibrary } = vi.hoisted(() => ({
  localMatch: vi.fn(),
  readLibrary: vi.fn(),
}));
vi.mock("@/lib/rekordbox/browserMatch", () => ({
  matchInBrowser: localMatch,
  readLocalLibrary: readLibrary,
}));
import {
  fetchPlaylistWithRekordbox,
  matchSnapshotWithXml,
} from "@/lib/api/playlist";
describe("XML never enters HTTP requests", () => {
  beforeEach(() => {
    readLibrary.mockReset().mockResolvedValue({});
    localMatch.mockReset().mockResolvedValue({
      matches: [
        {
          owned: false,
          owned_reason: null,
          library_match: { status: "not_found", reason: "no_match" },
        },
      ],
      meta: { ownership_rules_version: 4, match_engine: "browser-v1" },
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  it("fetches Spotify only and matches XML locally", async () => {
    const network = vi.fn(
      async (input: RequestInfo | URL) =>
        new Response(
          JSON.stringify(
            String(input).includes("health")
              ? { status: "ok" }
              : {
                  playlist_id: "p",
                  playlist_name: "P",
                  tracks: [{ title: "Song", artist: "A" }],
                  meta: { refresh: false },
                },
          ),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", network);
    const file = new File(["private-library"], "private-name.xml");
    const response = await fetchPlaylistWithRekordbox({
      url: "https://open.spotify.com/playlist/0jKqvXbsroCPdccFmORnPz",
      file,
    });
    expect(response.tracks[0].owned).toBe(false);
    for (const [url, options] of network.mock.calls as unknown as Array<
      [string, RequestInit | undefined]
    >) {
      expect(url).not.toContain("rekordbox");
      expect(url).not.toContain("snapshot");
      expect(options?.body).toBeUndefined();
    }
    expect(localMatch).toHaveBeenCalled();
  });
  it("rechecks a snapshot without a network connection", async () => {
    const network = vi.fn(() => {
      throw new Error("offline");
    });
    vi.stubGlobal("fetch", network);
    const response = await matchSnapshotWithXml(
      JSON.stringify({
        schema: "playlist_snapshot",
        version: 1,
        tracks: [{ title: "Song", artist: "A" }],
      }),
      new File(["private"], "private.xml"),
    );
    expect(response.tracks?.[0].owned).toBe(false);
    expect(network).not.toHaveBeenCalled();
  });
});
