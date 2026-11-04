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
