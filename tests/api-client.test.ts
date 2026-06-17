import { afterEach, describe, expect, test, vi } from "vitest";
import { fetchJson } from "@/lib/api/client";
import { PlaylistResponseSchema } from "@/lib/api/responseSchemas";

describe("fetchJson", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("throws normalized backend errors for non-2xx responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: { error: "backend failed", used_source: "spotify" },
        }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    await expect(
      fetchJson("/api/playlist", undefined, PlaylistResponseSchema),
    ).rejects.toMatchObject({
      message: "Something went wrong. Please try again.",
      status: 400,
      detail: { error: "backend failed", used_source: "spotify" },
      retryable: false,
    });
  });

  test("throws normalized schema mismatch for invalid 2xx payloads", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ tracks: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(
      fetchJson("/api/playlist", undefined, PlaylistResponseSchema),
    ).rejects.toMatchObject({
      message: "Something went wrong. Please try again.",
      detail: expect.any(Array),
      retryable: false,
    });
  });
});
