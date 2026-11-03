import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { useBuyQueue } from "@/lib/state/useBuyQueue";
import SidePanels from "@/app/components/SidePanels";
import type { PlaylistRow, ResultState } from "@/lib/types";

const track = {
  index: 1,
  title: "Song",
  artist: "Artist",
  album: "Album",
  stores: {},
  owned: false,
} as PlaylistRow;
let queue: ReturnType<typeof useBuyQueue>;
function QueueHarness() {
  const value = useBuyQueue();
  useEffect(() => {
    queue = value;
  }, [value]);
  return null;
}

describe("persistent purchase queue and XML actions", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
  it("surfaces failed persistent saves and permits retry without losing page items", async () => {
    vi.useFakeTimers();
    const storage = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("Full", "QuotaExceededError");
      });
    await act(async () => {
      root.render(<QueueHarness />);
    });
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    await act(async () => {
      queue.addTrack(track, {
        name: "Beatport",
        url: "https://beatport.com/search?q=song",
      });
    });
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(queue.items).toHaveLength(1);
    expect(queue.storageWarning).toContain("storage failed");
    storage.mockRestore();
    act(() => queue.retrySave());
    expect(queue.storageWarning).toBeNull();
    expect(
      JSON.parse(localStorage.getItem("playlist-shopper-buy-queue")!),
    ).toHaveLength(1);
  });
  it("does not overwrite unreadable existing storage", async () => {
    vi.useFakeTimers();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    const write = vi.spyOn(Storage.prototype, "setItem");
    await act(async () => {
      root.render(<QueueHarness />);
    });
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(queue.storageWarning).toContain("could not be read");
    expect(write).not.toHaveBeenCalled();
  });
  it.each(["{broken", "{}", '[{"id":"partial"}]', ""])(
    "preserves corrupt queue data without silently overwriting it: %s",
    async (raw) => {
      vi.useFakeTimers();
      localStorage.setItem("playlist-shopper-buy-queue", raw);
      const write = vi.spyOn(Storage.prototype, "setItem");
      await act(async () => {
        root.render(<QueueHarness />);
      });
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });
      expect(queue.storageWarning).toContain(
        "Existing saved data has been kept",
      );
      act(() =>
        queue.addTrack(track, {
          name: "Beatport",
          url: "https://beatport.com",
        }),
      );
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });
      expect(queue.items).toHaveLength(0);
      expect(write).not.toHaveBeenCalled();
      expect(localStorage.getItem("playlist-shopper-buy-queue")).toBe(raw);
      localStorage.setItem("playlist-shopper-buy-queue", "[]");
      act(() => queue.retrySave());
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });
      expect(queue.storageWarning).toBeNull();
    },
  );
  it("pauses queue edits when another tab changes saved items", async () => {
    vi.useFakeTimers();
    await act(async () => {
      root.render(<QueueHarness />);
    });
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    act(() =>
      window.dispatchEvent(
        new StorageEvent("storage", { key: "playlist-shopper-buy-queue" }),
      ),
    );
    act(() =>
      queue.addTrack(track, { name: "Beatport", url: "https://beatport.com" }),
    );
    expect(queue.items).toHaveLength(0);
    act(() => queue.retrySave());
    act(() =>
      queue.addTrack(track, { name: "Beatport", url: "https://beatport.com" }),
    );
    expect(queue.items).toHaveLength(1);
  });
  it("uses a keyboard-focusable action and rechecks all tracks despite filters", async () => {
    const tracks = [track, { ...track, index: 2, title: "Other" }];
    const result = {
      title: "P",
      total: 2,
      tracks,
      playlistUrl: "u",
      analyzedAt: 0,
    } as ResultState;
    const apply = vi.fn().mockResolvedValue(undefined);
    await act(async () => {
      root.render(
        <SidePanels
          currentResult={result}
          ownedCount={0}
          toBuyCount={2}
          unknownCount={0}
          displayedTracks={[track]}
          rekordboxFile={null}
          applySnapshotWithXml={apply}
          handleExportCSV={() => {}}
        />,
      );
    });
    const button = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Re-analyze all tracks with XML",
    )!;
    expect(button.type).toBe("button");
    expect(button.tabIndex).toBe(0);
    const input = container.querySelector("input[type=file]")!;
    const file = new File(["<DJ_PLAYLISTS/>"], "library.xml", {
      type: "text/xml",
    });
    Object.defineProperty(input, "files", { value: [file] });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(apply).toHaveBeenCalledWith(file, result, tracks);
    expect(container.textContent).toContain("Checked all 2 tracks.");
  });
});
