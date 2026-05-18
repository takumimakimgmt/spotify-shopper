import { afterEach, describe, expect, test, vi } from "vitest";
import { fetchJson, SchemaMismatch } from "@/lib/api/client";
import { PlaylistResponseSchema } from "@/lib/api/responseSchemas";

describe("fetchJson", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("throws backend error body as-is for non-2xx responses", async () => {
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
      status: 400,
      data: { detail: { error: "backend failed", used_source: "spotify" } },
    });
  });

  test("throws SchemaMismatch for invalid 2xx payloads", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ tracks: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(
      fetchJson("/api/playlist", undefined, PlaylistResponseSchema),
    ).rejects.toBeInstanceOf(SchemaMismatch);
  });
});
