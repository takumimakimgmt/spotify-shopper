import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import {
  effectiveOwned,
  libraryMatchExplanation,
  libraryCheckState,
} from "@/lib/domain/libraryMatch";
import { withPlaylistChanges } from "@/lib/domain/playlistChanges";
import ResultsFilterBar from "@/app/components/ResultsFilterBar";
import { useFiltersState } from "@/lib/state/useFiltersState";
import type { PlaylistRow, ResultState } from "@/lib/types";
const base: PlaylistRow = {
  index: 0,
  title: "Starlight - Remix",
  artist: "Artist",
  stores: {},
  owned: true,
  ownedReason: "exact",
  libraryMatch: {
    status: "matched",
    reason: "exact",
    matched_title: "Starlight (Remix)",
    matched_artist: "Artist",
  },
};
it("separates normalized matches from contradictory evidence without modifying raw evidence", () => {
  expect(effectiveOwned(base)).toBe(true);
  expect(libraryMatchExplanation(base)).toContain("after normalization");
  const inconsistent = { ...base, ownedReason: "version_mismatch" };
  const before = JSON.stringify(inconsistent);
  expect(libraryCheckState(inconsistent)).toBe("review");
  expect(effectiveOwned(inconsistent)).toBeNull();
  expect(libraryMatchExplanation(inconsistent)).toContain("inconsistent");
  expect(JSON.stringify(inconsistent)).toBe(before);
  expect(
    effectiveOwned({
      ...inconsistent,
      reviewDecision: { action: "owned" },
    } as PlaylistRow),
  ).toBe(true);
  expect(
    libraryMatchExplanation({
      ...base,
      ownedReason: "isrc",
      libraryMatch: { ...base.libraryMatch!, reason: "isrc" },
    }),
  ).toContain("identifier matched");
});
it("does not label an initial check as a change from a previous check", () => {
  const result = {
    tracks: [{ ...base, changeStatus: "added" }],
    total: 1,
  } as ResultState;
  expect(withPlaylistChanges(result).tracks[0].changeStatus).toBeUndefined();
  expect(withPlaylistChanges(result).changeSummary?.hasPrevious).toBe(false);
  expect(withPlaylistChanges(result, result).tracks[0].changeStatus).toBe(
    "unchanged",
  );
});
it("shows all category counts including zero and changes the explanatory hint with the filter", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  function Harness() {
    const filters = useFiltersState();
    return (
      <ResultsFilterBar
        result={
          {
            hasRekordboxData: true,
            tracks: [
              base,
              {
                ...base,
                owned: null,
                ownedReason: "version_mismatch",
                libraryMatch: { status: "review", reason: "version_mismatch" },
              },
            ],
            meta: { rekordbox: { library_track_count: 2286 } },
          } as ResultState
        }
        filters={filters}
        queue={<button>Buy Later</button>}
      />
    );
  }
  try {
    await act(async () => root.render(<Harness />));
    const buttons = [...host.querySelectorAll("[aria-pressed]")];
    expect(buttons.map((x) => x.textContent?.replace(/\s+/g, " "))).toEqual([
      "All 2",
      "Not in XML 0",
      "Matched / confirmed 1",
      "Needs review 1",
      "Not checked 0",
    ]);
    await act(async () => (buttons[3] as HTMLButtonElement).click());
    expect(host.querySelector('[role="status"]')?.textContent).toContain(
      "Compare the version and artist",
    );
    expect(buttons[3].getAttribute("aria-pressed")).toBe("true");
    expect(host.textContent).toContain("2286 XML entries checked");
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
