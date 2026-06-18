import { afterEach, describe, expect, test, vi } from "vitest";
import { fetchJson, fetchWithTimeout } from "@/lib/api/client";
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

describe("fetchWithTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("aborts the fetch when the caller signal aborts", async () => {
    const caller = new AbortController();
    let fetchSignal: AbortSignal | undefined;
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      fetchSignal = init?.signal ?? undefined;
      return new Promise((_resolve, reject) => {
        fetchSignal?.addEventListener("abort", () =>
          reject(fetchSignal?.reason),
        );
      });
    });

    const request = fetchWithTimeout(
      "/api/playlist",
      { method: "POST", signal: caller.signal },
      25_000,
    );
    caller.abort();

    await expect(request).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchSignal?.aborted).toBe(true);
  });

  test("passes an already-aborted caller signal to fetch", async () => {
    const caller = new AbortController();
    caller.abort();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(caller.signal.reason);

    await expect(
      fetchWithTimeout("/api/playlist", { signal: caller.signal }, 25_000),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  test("aborts on timeout without dropping other fetch init fields", async () => {
    vi.useFakeTimers();
    let fetchSignal: AbortSignal | undefined;
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((_url, init) => {
        fetchSignal = init?.signal ?? undefined;
        return new Promise((_resolve, reject) => {
          fetchSignal?.addEventListener("abort", () =>
            reject(fetchSignal?.reason),
          );
        });
      });

    const request = fetchWithTimeout(
      "/api/playlist",
      { method: "POST", headers: { "x-test": "yes" } },
      100,
    );
    const rejection = expect(request).rejects.toMatchObject({
      name: "AbortError",
    });
    await vi.advanceTimersByTimeAsync(100);

    await rejection;
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/playlist",
      expect.objectContaining({
        method: "POST",
        headers: { "x-test": "yes" },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  test("clears the timeout after a successful fetch", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null));

    await fetchWithTimeout("/api/playlist", {}, 100);

    expect(vi.getTimerCount()).toBe(0);
  });
});
