import { webcrypto } from "node:crypto";
import { afterEach, describe, it, expect, vi } from "vitest";
import { matchInBrowser } from "@/lib/rekordbox/browserMatch";

class FakeWorker {
  static instances: FakeWorker[] = [];
  static mode = "complete";
  static abort: (() => void) | undefined;
  onmessage: ((event: MessageEvent) => void) | undefined;
  onerror: (() => void) | undefined;
  terminated = false;
  constructor() {
    FakeWorker.instances.push(this);
  }
  terminate() {
    this.terminated = true;
  }
  postMessage() {
    if (FakeWorker.mode === "abort") {
      FakeWorker.abort?.();
      return;
    }
    queueMicrotask(() =>
      this.onmessage?.({
        data: {
          matches: [
            {
              owned: false,
              owned_reason: null,
              library_match: { status: "not_found", reason: "no_match" },
            },
          ],
        },
      } as MessageEvent),
    );
  }
}
const file = () =>
  new File(["<DJ_PLAYLISTS><COLLECTION/></DJ_PLAYLISTS>"], "library.xml", {
    type: "text/xml",
  });
afterEach(() => {
  vi.unstubAllGlobals();
  FakeWorker.instances = [];
  FakeWorker.abort = undefined;
});
describe("local worker lifetime", () => {
  it("terminates workers after a complete atomic result", async () => {
    vi.stubGlobal("crypto", webcrypto);
    vi.stubGlobal("Worker", FakeWorker);
    FakeWorker.mode = "complete";
    const result = await matchInBrowser(
      [{ title: "Song", artist: "A" }],
      file(),
    );
    expect(result.matches[0].owned).toBe(false);
    expect(result.meta.match_engine).toBe("browser-v1");
    expect(FakeWorker.instances[0].terminated).toBe(true);
  });
  it("terminates a cancelled worker without returning partial matches", async () => {
    vi.stubGlobal("crypto", webcrypto);
    vi.stubGlobal("Worker", FakeWorker);
    FakeWorker.mode = "abort";
    const controller = new AbortController();
    FakeWorker.abort = () => controller.abort();
    await expect(
      matchInBrowser(
        [{ title: "Song", artist: "A" }],
        file(),
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(FakeWorker.instances[0].terminated).toBe(true);
  });
  it("does not fall back to XML upload if workers are unavailable", async () => {
    vi.stubGlobal("crypto", webcrypto);
    vi.stubGlobal("Worker", undefined);
    const network = vi.fn();
    vi.stubGlobal("fetch", network);
    await expect(matchInBrowser([], file())).rejects.toThrow(
      "has not been sent",
    );
    expect(network).not.toHaveBeenCalled();
  });
});
