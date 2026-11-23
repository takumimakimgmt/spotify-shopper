import React, { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { buyLaterBatch } from "@/lib/domain/buyLaterBatch";
import { recordingKey } from "@/lib/domain/recordingIdentity";
import { useBuyQueue } from "@/lib/state/useBuyQueue";
import { STORAGE_KEYS } from "@/lib/storage/keys";
import ResultsTable from "@/app/components/ResultsTable";
import type { PlaylistRow } from "@/lib/types";
const tracks: PlaylistRow[] = Array.from({ length: 25 }, (_, index) => ({
  index,
  title: `Song ${index + 1}`,
  artist: "Artist",
  album: "Album",
  owned: false,
  stores: {},
}));
it("deduplicates the whole filtered set and excludes owned/unverified/reviewed tracks", () => {
  const batch = buyLaterBatch(
    [
      ...tracks,
      tracks[1],
      { ...tracks[0], title: "Owned", owned: true },
      { ...tracks[0], title: "Unknown", owned: null },
      {
        ...tracks[0],
        title: "Confirmed",
        reviewDecision: { action: "owned" },
      } as PlaylistRow,
    ],
    new Set([recordingKey(tracks[0])]),
  );
  expect(batch).toHaveLength(24);
  expect(batch.at(-1)?.track.title).toBe("Song 25");
  expect(batch.every((x) => x.buyLink.name === "Beatport")).toBe(true);
});
it("adds the batch atomically and persists it without duplicating a second save", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  let queue: ReturnType<typeof useBuyQueue>;
  function Harness() {
    const value = useBuyQueue();
    useEffect(() => {
      queue = value;
    }, [value]);
    return null;
  }
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<Harness />));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    let added = 0;
    await act(async () => {
      added = queue.addTracks(buyLaterBatch(tracks, new Set()));
    });
    expect(added).toBe(25);
    expect(queue!.items).toHaveLength(25);
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEYS.buyQueue)!),
    ).toHaveLength(25);
    await act(async () => {
      added = queue.addTracks(buyLaterBatch(tracks, new Set()));
    });
    expect(added).toBe(0);
    expect(queue!.items).toHaveLength(25);
    const original = queue!.items.map((x) => x.id);
    await act(async () => queue.removeItem(original[8]));
    expect(queue!.items).toHaveLength(24);
    expect(queue!.removedCount).toBe(1);
    await act(async () =>
      queue.addTracks(buyLaterBatch([tracks[8]], new Set())),
    );
    expect(queue!.removedCount).toBe(0);
    await act(async () => queue.removeItem(original[8]));
    await act(async () => queue.undoRemove());
    expect(new Set(queue!.items.map((x) => x.id))).toEqual(new Set(original));
    await act(async () => queue.clearItems());
    expect(queue!.items).toHaveLength(0);
    expect(queue!.removedCount).toBe(25);
    await act(async () =>
      queue.addTracks(buyLaterBatch(tracks.slice(0, 1), new Set())),
    );
    await act(async () => queue.undoRemove());
    expect(new Set(queue!.items.map((x) => x.id)).size).toBe(25);
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEYS.buyQueue)!),
    ).toHaveLength(25);
  } finally {
    act(() => root.unmount());
    host.remove();
    localStorage.clear();
  }
});
it("offers the full filtered count while showing only the current page", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const save = vi.fn();
  const open = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <ResultsTable
          compactStatus
          currentResult={{}}
          displayedTracks={tracks}
          onSaveBatch={save}
          onOpenBuyQueue={open}
          saveBatchCount={25}
        />,
      ),
    );
    const button = [...host.querySelectorAll("button")].find(
      (x) => x.textContent === "Add to Buy Later",
    )!;
    expect(button).toBeTruthy();
    expect(host.querySelector("table tbody tr td")?.textContent).not.toContain(
      "Not in XML",
    );
    const details = [...host.querySelectorAll("table button")].find((x) =>
      x.textContent?.includes("Matching details"),
    )!;
    await act(async () => details.click());
    expect(details.getAttribute("aria-expanded")).toBe("true");
    expect(host.querySelector("table")?.textContent).not.toContain("Song 25");
    await act(async () => button.click());
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () =>
      root.render(
        <ResultsTable
          compactStatus
          currentResult={{}}
          displayedTracks={tracks}
          onSaveBatch={save}
          onOpenBuyQueue={open}
          saveBatchCount={0}
        />,
      ),
    );
    expect(host.textContent).toContain("25 tracks saved");
    expect(host.textContent).not.toContain("All eligible tracks");
    const view = [...host.querySelectorAll("button")].find(
      (x) => x.textContent === "View saved tracks",
    )!;
    await act(async () => view.click());
    expect(open).toHaveBeenCalledTimes(1);
    expect([...host.querySelectorAll("th")].map((e) => e.textContent)).toEqual([
      "Track",
      "Store",
      "Save",
    ]);
    expect(details.closest("td")?.textContent).toContain("Song 1");
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
