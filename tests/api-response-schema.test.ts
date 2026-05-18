import { describe, expect, test } from "vitest";
import { PlaylistResponseSchema } from "../lib/api/responseSchemas";

describe("PlaylistResponseSchema", () => {
  test("passes with backend playlist response shape", () => {
    const r = PlaylistResponseSchema.safeParse({
      playlist_id: "abc123",
      playlist_name: "My Playlist",
      playlist_url: "https://open.spotify.com/playlist/abc123",
      tracks: [
        {
          title: "Track A",
          artist: "Artist A",
          album: "Album A",
          isrc: "JP1234567890",
          spotify_url: "https://open.spotify.com/track/xxx",
          apple_url: null,
          links: {
            beatport: "",
            bandcamp: "",
            itunes: "",
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
        cache_hit: false,
        total_api_ms: 123.4,
      },
    });

    expect(r.success).toBe(true);
  });

  test("passes when backend omits nullable optionals", () => {
    const r = PlaylistResponseSchema.safeParse({
      playlist_id: "abc123",
      playlist_name: "My Playlist",
      tracks: [
        {
          title: "Track A",
          artist: "Artist A",
        },
      ],
    });

    expect(r.success).toBe(true);
  });

  test("passes when backend sends nullable optionals as null", () => {
    const r = PlaylistResponseSchema.safeParse({
      playlist_id: "abc123",
      playlist_name: "My Playlist",
      playlist_url: null,
      tracks: [
        {
          title: "Track A",
          artist: "Artist A",
          album: null,
          isrc: null,
          spotify_url: null,
          apple_url: null,
          links: null,
          owned: null,
          owned_reason: null,
          track_key_primary: null,
          track_key_fallback: null,
        },
      ],
      meta: null,
    });

    expect(r.success).toBe(true);
  });

  test("fails when required top-level fields are missing", () => {
    const r = PlaylistResponseSchema.safeParse({
      playlist_name: "My Playlist",
      tracks: [],
    });

    expect(r.success).toBe(false);
  });

  test("fails when tracks is not an array", () => {
    const r = PlaylistResponseSchema.safeParse({
      playlist_id: "abc123",
      playlist_name: "My Playlist",
      tracks: "x",
    });

    expect(r.success).toBe(false);
  });
});
