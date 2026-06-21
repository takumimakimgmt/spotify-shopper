import { describe, expect, test } from "vitest";
import { validateSpotifyPlaylistInput } from "@/app/api/_proxy";

const playlistId = "588N4Kt4446o660ARpswUD";
const invalidMessage = "Enter a Spotify playlist URL, URI, or ID.";

describe("validateSpotifyPlaylistInput", () => {
  test.each([
    [
      "full URL with query string",
      `https://open.spotify.com/playlist/${playlistId}?si=99a8b205eabf4bb0`,
    ],
    [
      "full URL without query string",
      `https://open.spotify.com/playlist/${playlistId}`,
    ],
    ["http URL", `http://open.spotify.com/playlist/${playlistId}`],
    ["Spotify URI", `spotify:playlist:${playlistId}`],
    ["raw playlist ID", playlistId],
  ])("accepts %s", (_name, input) => {
    expect(validateSpotifyPlaylistInput(input)).toEqual({ ok: true });
  });

  test.each([
    ["empty string", ""],
    ["random text", "not a playlist"],
    ["Spotify track URL", `https://open.spotify.com/track/${playlistId}`],
    ["Spotify album URL", `https://open.spotify.com/album/${playlistId}`],
    ["non-Spotify URL", `https://example.com/playlist/${playlistId}`],
    ["malformed URI", "spotify:playlist:not-a-valid-id"],
  ])("rejects %s", (_name, input) => {
    expect(validateSpotifyPlaylistInput(input)).toEqual({
      ok: false,
      message: invalidMessage,
    });
  });

  test("rejects null", () => {
    expect(validateSpotifyPlaylistInput(null)).toEqual({
      ok: false,
      message: invalidMessage,
    });
  });
});
