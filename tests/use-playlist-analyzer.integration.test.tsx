import { act, type FormEvent, useEffect } from "react";
import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { usePlaylistAnalyzer } from "@/lib/state/usePlaylistAnalyzer";

const getPlaylistMock = vi.fn();

vi.mock("@/lib/api/playlist", () => ({
  getPlaylist: (...args: unknown[]) => getPlaylistMock(...args),
  postPlaylistWithRekordboxUpload: vi.fn(),
  matchSnapshotWithXml: vi.fn(),
}));

type AnalyzerApi = ReturnType<typeof usePlaylistAnalyzer>;

function Harness(props: { onRender: (api: AnalyzerApi) => void }) {
  const api = usePlaylistAnalyzer();

  useEffect(() => {
    props.onRender(api);
  }, [api, props]);

  return null;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("usePlaylistAnalyzer Spotify happy path", () => {
  let container: HTMLDivElement;
  let root: Root;
  let currentApi: AnalyzerApi | null = null;
  let rafSpy: ReturnType<typeof vi.spyOn> | null = null;
  let logSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    currentApi = null;
    getPlaylistMock.mockReset();
    rafSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(performance.now());
        return 1;
      });
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    rafSpy?.mockRestore();
    logSpy?.mockRestore();
  });

  test("loads a Spotify playlist and normalizes tracks into multiResults", async () => {
    getPlaylistMock.mockResolvedValue({
      playlist_id: "abc123",
      playlist_name: "My Playlist",
      playlist_url: "https://open.spotify.com/playlist/abc123",
      tracks: [
        {
          title: "Track A",
          artist: "Artist A",
          album: "Album A",
          isrc: "JP1234567890",
          spotify_url: "https://open.spotify.com/track/track-a",
          apple_url: null,
          links: {
            beatport: "https://beatport.example/track-a",
            bandcamp: "",
            itunes: null,
          },
          owned: false,
          owned_reason: null,
          track_key_primary: "isrc:JP1234567890",
          track_key_fallback: "norm:track a|artist a|album a",
          track_key_primary_type: "isrc",
          track_key_version: "v1",
        },
      ],
      meta: {
        cache_hit: true,
        refresh: false,
        blocked_hint: null,
      },
    });

    await act(async () => {
      root.render(<Harness onRender={(api) => void (currentApi = api)} />);
    });

    expect(currentApi).not.toBeNull();

    act(() => {
      currentApi!.setPlaylistUrlInput(
        "https://open.spotify.com/playlist/abc123",
      );
    });

    await act(async () => {
      await currentApi!.handleAnalyze({
        preventDefault() {},
      } as FormEvent);
    });

    await flush();

    expect(getPlaylistMock).toHaveBeenCalledTimes(1);
    expect(getPlaylistMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://open.spotify.com/playlist/abc123",
        source: "spotify",
        refresh: false,
        signal: expect.any(AbortSignal),
      }),
    );

    expect(currentApi!.errorText).toBeNull();
    expect(currentApi!.loading).toBe(false);
    expect(currentApi!.multiResults).toHaveLength(1);
    expect(currentApi!.progressItems).toEqual([
      expect.objectContaining({
        url: "https://open.spotify.com/playlist/abc123",
        status: "done",
        message: "1 tracks",
      }),
    ]);

    const [url, result] = currentApi!.multiResults[0];
    expect(url).toBe("https://open.spotify.com/playlist/abc123");
    expect(result.title).toBe("My Playlist");
    expect(result.playlist_id).toBe("abc123");
    expect(result.playlistUrl).toBe("https://open.spotify.com/playlist/abc123");
    expect(result.total).toBe(1);
    expect(result.hasRekordboxData).toBe(false);
    expect(result.meta).toEqual(
      expect.objectContaining({
        cache_hit: true,
        refresh: false,
        client_total_ms: expect.any(Number),
        client_api_ms: expect.any(Number),
        client_map_ms: expect.any(Number),
        client_overhead_ms: expect.any(Number),
        payload_bytes: expect.any(Number),
      }),
    );
    expect(result.meta).not.toHaveProperty("blocked_hint");
    expect(result.tracks).toEqual([
      expect.objectContaining({
        index: 1,
        title: "Track A",
        artist: "Artist A",
        album: "Album A",
        isrc: "JP1234567890",
        spotifyUrl: "https://open.spotify.com/track/track-a",
        appleUrl: undefined,
        stores: {
          beatport: "https://beatport.example/track-a",
          bandcamp: "",
          itunes: "",
        },
        owned: false,
        ownedReason: undefined,
        trackKeyPrimary: "isrc:JP1234567890",
        trackKeyFallback: "norm:track a|artist a|album a",
        trackKeyPrimaryType: "isrc",
        trackKeyGuess: "",
      }),
    ]);
  });
});
