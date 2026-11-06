import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import ResultsTable from "@/app/components/ResultsTable";
import type { PlaylistRow } from "@/lib/types";

it("opens the selected recording's full-width evidence and preserves review actions", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const tracks: PlaylistRow[] = ["First", "Second"].map((title, index) => ({
    index,
    title,
    artist: "Artist",
    album: "Album",
    stores: {},
    owned: null,
    libraryMatch: {
      status: "review",
      reason: "version_mismatch",
      matched_title: `${title} (Other Remix)`,
      matched_artist: "Artist",
    },
    changeStatus: "unchanged",
  }));
  const onReviewDecision = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <ResultsTable
          currentResult={{}}
          displayedTracks={tracks}
          onReviewDecision={onReviewDecision}
          reviewReady
        />,
      ),
    );
    const toggles = [
      ...host.querySelectorAll<HTMLButtonElement>("button[aria-controls]"),
    ];
    const panels = toggles.map(
      (button) =>
        document.getElementById(button.getAttribute("aria-controls")!)!,
    );
    expect(panels.every((panel) => panel.hidden)).toBe(true);
    expect(toggles[0].textContent).not.toContain("unchanged");
    await act(async () => toggles[1].click());
    expect(toggles[1].getAttribute("aria-expanded")).toBe("true");
    expect(panels[0].hidden).toBe(true);
    expect(panels[1].hidden).toBe(false);
    expect(panels[1].textContent).toContain("Second (Other Remix)");
    const confirm = [...panels[1].querySelectorAll("button")].find(
      (button) => button.textContent === "I own this recording",
    )!;
    await act(async () => confirm.click());
    expect(onReviewDecision).toHaveBeenCalledWith(tracks[1], "owned");
    await act(async () => toggles[1].click());
    expect(panels[1].hidden).toBe(true);
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

it("pages the full filtered set, resets for new filters and keeps row actions on the right track", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const tracks: PlaylistRow[] = Array.from({ length: 45 }, (_, i) => ({
    index: i,
    title: `Track ${i + 1}`,
    artist: "Artist",
    album: "Album",
    stores: {},
    owned: false,
  }));
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const render = async (key: string, rows = tracks) =>
    act(async () =>
      root.render(
        <ResultsTable
          currentResult={{}}
          displayedTracks={rows}
          paginationKey={key}
        />,
      ),
    );
  try {
    await render("all");
    const table = () => host.querySelector("table")!;
    expect(table().textContent).toContain("Track 20");
    expect(table().textContent).not.toContain("Track 21");
    const nav = () => host.querySelector("nav")!;
    const next = () =>
      [...nav().querySelectorAll("button")].find(
        (b) => b.textContent === "Next",
      )!;
    await act(async () => next().click());
    expect(table().textContent).toContain("Track 21");
    expect(table().textContent).not.toContain("Track 1Artist");
    await act(async () => next().click());
    expect(table().textContent).toContain("Track 45");
    expect(next().disabled).toBe(true);
    await render("search", tracks.slice(0, 3));
    expect(table().textContent).toContain("Track 1");
    expect(host.querySelector("nav")?.textContent).toContain("1–3 of 3 tracks");
    await render("all");
    expect(host.querySelector("nav")?.textContent).toContain(
      "1–20 of 45 tracks",
    );
    const select = host.querySelector("select")!;
    await act(async () => {
      select.value = "50";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(table().textContent).toContain("Track 45");
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
