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
  } finally {
    act(() => root.unmount());
    host.remove();
    localStorage.clear();
  }
});
it("offers the full filtered count while showing only the current page", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const save = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <ResultsTable
          currentResult={{}}
          displayedTracks={tracks}
          onSaveBatch={save}
          saveBatchCount={25}
        />,
      ),
    );
    const button = [...host.querySelectorAll("button")].find(
      (x) => x.textContent === "Save 25 tracks",
    )!;
    expect(button).toBeTruthy();
    expect(host.querySelector("table")?.textContent).not.toContain("Song 25");
    await act(async () => button.click());
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () =>
      root.render(
        <ResultsTable
          currentResult={{}}
          displayedTracks={tracks}
          onSaveBatch={save}
          saveBatchCount={0}
        />,
      ),
    );
    const complete = [...host.querySelectorAll("button")].find(
      (x) => x.textContent === "All saved",
    )!;
    expect(complete.disabled).toBe(true);
    expect(host.textContent).toContain(
      "All eligible tracks in this filter are already saved.",
    );
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
