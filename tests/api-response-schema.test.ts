import { describe, expect, test } from "vitest";
import { PlaylistResponseSchema } from "../lib/api/responseSchemas";

describe("FE-1 API response schemas", () => {
  test("valid playlist ok response passes", () => {
    const r = PlaylistResponseSchema.safeParse({
      ok: true,
      tracks: [{ title: "t", artists: ["a"] }],
      meta: { any: "thing" },
    });
    expect(r.success).toBe(true);
  });

  test("valid playlist error response passes", () => {
    const r = PlaylistResponseSchema.safeParse({
      ok: false,
      message: "bad",
    });
    expect(r.success).toBe(true);
  });

  test("invalid playlist response fails", () => {
    const r = PlaylistResponseSchema.safeParse({ ok: true, tracks: "x" });
    expect(r.success).toBe(false);
  });
});
