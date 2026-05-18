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

describe("usePlaylistAnalyzer Spotify flow", () => {
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

  test("surfaces a Spotify fetch failure without inserting multiResults", async () => {
    getPlaylistMock.mockRejectedValue({
      message: "request failed",
      data: {
        detail: {
          error: "backend exploded",
          used_source: "spotify",
          meta: {},
        },
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
    expect(currentApi!.loading).toBe(false);
    expect(currentApi!.multiResults).toEqual([]);
    expect(currentApi!.errorText).toBe(
      "Spotifyの取得に失敗しました / Spotify request failed: backend exploded",
    );
    expect(currentApi!.progressItems).toEqual([
      expect.objectContaining({
        url: "https://open.spotify.com/playlist/abc123",
        status: "error",
        message: "request failed",
      }),
    ]);
  });

  test("keeps only the successful result during a mixed multi-URL run", async () => {
    const successUrl = "https://open.spotify.com/playlist/success123";
    const failureUrl = "https://open.spotify.com/playlist/failure456";

    getPlaylistMock
      .mockResolvedValueOnce({
        playlist_id: "success123",
        playlist_name: "Success Playlist",
        playlist_url: successUrl,
        tracks: [
          {
            title: "Track S",
            artist: "Artist S",
            album: "Album S",
            isrc: "JP0000000001",
            spotify_url: "https://open.spotify.com/track/track-s",
            apple_url: null,
            links: {
              beatport: "",
              bandcamp: "",
              itunes: "",
            },
            owned: false,
            owned_reason: null,
            track_key_primary: "isrc:JP0000000001",
            track_key_fallback: "norm:track s|artist s|album s",
            track_key_primary_type: "isrc",
            track_key_version: "v1",
          },
        ],
        meta: {
          cache_hit: false,
          refresh: false,
        },
      })
      .mockRejectedValueOnce({
        message: "request failed",
        data: {
          detail: {
            error: "second playlist failed",
            used_source: "spotify",
            meta: {},
          },
        },
      });

    await act(async () => {
      root.render(<Harness onRender={(api) => void (currentApi = api)} />);
    });

    expect(currentApi).not.toBeNull();

    act(() => {
      currentApi!.setPlaylistUrlInput(`${successUrl}\n${failureUrl}`);
    });

    await act(async () => {
      await currentApi!.handleAnalyze({
        preventDefault() {},
      } as FormEvent);
    });

    await flush();

    expect(getPlaylistMock).toHaveBeenCalledTimes(2);
    expect(getPlaylistMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        url: successUrl,
        source: "spotify",
        refresh: false,
      }),
    );
    expect(getPlaylistMock.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        url: failureUrl,
        source: "spotify",
        refresh: false,
      }),
    );

    expect(currentApi!.loading).toBe(false);
    expect(currentApi!.multiResults).toHaveLength(1);
    expect(currentApi!.multiResults[0]?.[0]).toBe(successUrl);
    expect(currentApi!.multiResults[0]?.[1]).toEqual(
      expect.objectContaining({
        title: "Success Playlist",
        playlist_id: "success123",
        playlistUrl: successUrl,
        total: 1,
      }),
    );
    expect(currentApi!.errorText).toBe(
      "Spotifyの取得に失敗しました / Spotify request failed: second playlist failed",
    );
    expect(currentApi!.progressItems).toEqual([
      expect.objectContaining({
        url: successUrl,
        status: "done",
        message: "1 tracks",
      }),
      expect.objectContaining({
        url: failureUrl,
        status: "error",
        message: "request failed",
      }),
    ]);
  });

  test("replaces only matching URLs and preserves unrelated existing multiResults", async () => {
    const targetUrl = "https://open.spotify.com/playlist/replace123";
    const preservedUrl = "https://open.spotify.com/playlist/preserve456";

    getPlaylistMock.mockResolvedValue({
      playlist_id: "replace123",
      playlist_name: "Fresh Playlist",
      playlist_url: targetUrl,
      tracks: [
        {
          title: "Fresh Track",
          artist: "Fresh Artist",
          album: "Fresh Album",
          isrc: "JP0000000002",
          spotify_url: "https://open.spotify.com/track/fresh-track",
          apple_url: null,
          links: {
            beatport: "",
            bandcamp: "",
            itunes: "",
          },
          owned: false,
          owned_reason: null,
          track_key_primary: "isrc:JP0000000002",
          track_key_fallback: "norm:fresh track|fresh artist|fresh album",
          track_key_primary_type: "isrc",
          track_key_version: "v1",
        },
      ],
      meta: {
        cache_hit: false,
        refresh: false,
      },
    });

    await act(async () => {
      root.render(<Harness onRender={(api) => void (currentApi = api)} />);
    });

    expect(currentApi).not.toBeNull();

    act(() => {
      currentApi!.setMultiResults([
        [
          targetUrl,
          {
            title: "Stale Playlist",
            total: 99,
            playlistUrl: targetUrl,
            playlist_id: "replace123",
            playlist_name: "Stale Playlist",
            tracks: [],
            analyzedAt: 1,
            hasRekordboxData: false,
          },
        ],
        [
          preservedUrl,
          {
            title: "Preserved Playlist",
            total: 2,
            playlistUrl: preservedUrl,
            playlist_id: "preserve456",
            playlist_name: "Preserved Playlist",
            tracks: [],
            analyzedAt: 2,
            hasRekordboxData: false,
          },
        ],
      ]);
      currentApi!.setPlaylistUrlInput(targetUrl);
    });

    await act(async () => {
      await currentApi!.handleAnalyze({
        preventDefault() {},
      } as FormEvent);
    });

    await flush();

    expect(getPlaylistMock).toHaveBeenCalledTimes(1);
    expect(currentApi!.errorText).toBeNull();
    expect(currentApi!.multiResults).toHaveLength(2);
    expect(currentApi!.multiResults[0]?.[0]).toBe(targetUrl);
    expect(currentApi!.multiResults[0]?.[1]).toEqual(
      expect.objectContaining({
        title: "Fresh Playlist",
        total: 1,
        playlistUrl: targetUrl,
        playlist_id: "replace123",
        playlist_name: "Fresh Playlist",
      }),
    );
    expect(currentApi!.multiResults[1]).toEqual([
      preservedUrl,
      expect.objectContaining({
        title: "Preserved Playlist",
        total: 2,
        playlistUrl: preservedUrl,
        playlist_id: "preserve456",
        playlist_name: "Preserved Playlist",
      }),
    ]);
    expect(currentApi!.progressItems).toEqual([
      expect.objectContaining({
        url: targetUrl,
        status: "done",
        message: "1 tracks",
      }),
    ]);
  });
});
