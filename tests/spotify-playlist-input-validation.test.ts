import { afterEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxyToBackend, validateSpotifyPlaylistInput } from "@/app/api/_proxy";

const playlistId = "588N4Kt4446o660ARpswUD";
const invalidMessage = "Enter a Spotify playlist URL, URI, or ID.";
const originalBackendUrl = process.env.BACKEND_URL;
const originalMaxBodyBytes = process.env.PROXY_MAX_BODY_BYTES;
const originalMaxResponseBytes = process.env.PROXY_MAX_RESPONSE_BYTES;
const originalBackendProxyToken = process.env.BACKEND_PROXY_TOKEN;

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  restoreEnv("BACKEND_URL", originalBackendUrl);
  restoreEnv("PROXY_MAX_BODY_BYTES", originalMaxBodyBytes);
  restoreEnv("PROXY_MAX_RESPONSE_BYTES", originalMaxResponseBytes);
  restoreEnv("BACKEND_PROXY_TOKEN", originalBackendProxyToken);
  vi.restoreAllMocks();
});

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

describe("proxyToBackend playlist validation", () => {
  test("rejects invalid playlist URLs from JSON POST bodies", async () => {
    process.env.BACKEND_URL = "https://backend.example";

    const req = new NextRequest("https://app.example/api/playlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/playlist/nope" }),
    });

    const res = await proxyToBackend(req, "playlist");
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual(
      expect.objectContaining({
        error: "invalid_input",
        message: invalidMessage,
      }),
    );
  });

  test("rejects invalid playlist URLs from multipart POST bodies", async () => {
    process.env.BACKEND_URL = "https://backend.example";
    const form = new FormData();
    form.set("url", "https://example.com/playlist/nope");
    form.set("file", new File(["<DJ_PLAYLISTS />"], "collection.xml"));

    const req = new NextRequest(
      "https://app.example/api/playlist-with-rekordbox-upload",
      {
        method: "POST",
        body: form,
      },
    );

    const res = await proxyToBackend(req, "playlist-with-rekordbox-upload");
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual(
      expect.objectContaining({
        error: "invalid_input",
        message: invalidMessage,
      }),
    );
  });

  test("rejects malformed JSON before forwarding", async () => {
    process.env.BACKEND_URL = "https://backend.example";
    const req = new NextRequest("https://app.example/api/playlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"url":',
    });

    const res = await proxyToBackend(req, "playlist");

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual(
      expect.objectContaining({
        error: "invalid_input",
        message: "Invalid request body",
      }),
    );
  });

  test("rejects requests missing a required playlist URL", async () => {
    process.env.BACKEND_URL = "https://backend.example";
    const req = new NextRequest("https://app.example/api/playlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "spotify" }),
    });

    const res = await proxyToBackend(req, "playlist");

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual(
      expect.objectContaining({
        error: "invalid_input",
        message: invalidMessage,
      }),
    );
  });

  test("stops reading request bodies once the byte limit is exceeded", async () => {
    process.env.BACKEND_URL = "https://backend.example";
    process.env.PROXY_MAX_BODY_BYTES = "16";
    const req = new NextRequest("https://app.example/api/playlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: `spotify:playlist:${playlistId}` }),
    });

    const res = await proxyToBackend(req, "playlist");

    expect(res.status).toBe(413);
    await expect(res.json()).resolves.toEqual(
      expect.objectContaining({ error: "payload_too_large" }),
    );
  });

  test("stops reading upstream responses once the byte limit is exceeded", async () => {
    process.env.BACKEND_URL = "https://backend.example";
    process.env.PROXY_MAX_RESPONSE_BYTES = "8";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("123456"));
            controller.enqueue(new TextEncoder().encode("789012"));
            controller.close();
          },
        }),
        { status: 200 },
      ),
    );
    const req = new NextRequest(
      `https://app.example/api/playlist?url=${playlistId}`,
    );

    const res = await proxyToBackend(req, "playlist");

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual(
      expect.objectContaining({ error: "upstream_response_too_large" }),
    );
  });

  test("overwrites client-supplied backend tokens with the server token", async () => {
    process.env.BACKEND_URL = "https://backend.example";
    process.env.BACKEND_PROXY_TOKEN = "server-token";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const req = new NextRequest(
      `https://app.example/api/playlist?url=${playlistId}`,
      { headers: { "x-backend-token": "attacker-token" } },
    );

    const res = await proxyToBackend(req, "playlist");

    expect(res.status).toBe(200);
    const forwardedHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(forwardedHeaders.get("x-backend-token")).toBe("server-token");
  });
});
