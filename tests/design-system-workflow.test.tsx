import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import {
  libraryCheckState,
  libraryMatchLabel,
} from "@/lib/domain/libraryMatch";
import { selectDisplayedTracks } from "@/lib/ui/selectors";
import {
  buyLaterBatchSummary,
  buyLaterBatch,
} from "@/lib/domain/buyLaterBatch";
import { recordingKey } from "@/lib/domain/recordingIdentity";
import ProcessingBar from "@/app/components/ProcessingBar";
import ResultSummaryBar from "@/app/components/ResultSummaryBar";
import { TrackIdentity } from "@/app/components/TrackPresentation";
import type { PlaylistRow, ResultState } from "@/lib/types";
const base: PlaylistRow = {
  index: 0,
  title: "Track",
  artist: "Artist",
  album: "Album",
  stores: {},
  owned: null,
};
it("separates unchecked from review without changing ownership evidence or queue eligibility", () => {
  const unchecked = { ...base };
  const review = {
    ...base,
    title: "Review",
    libraryMatch: { status: "review" as const, reason: "version_mismatch" },
  };
  const different = {
    ...base,
    reviewDecision: { action: "different_version" as const },
  };
  expect([unchecked, review, different].map(libraryCheckState)).toEqual([
    "unchecked",
    "review",
    "review",
  ]);
  expect(libraryMatchLabel(review)).toBe("Needs review");
  const options = { searchQuery: "", sortKey: "none" as const };
  expect(
    selectDisplayedTracks([unchecked, review], {
      ...options,
      categoryFilter: "unchecked",
    }),
  ).toEqual([unchecked]);
  expect(
    selectDisplayedTracks([unchecked, review], {
      ...options,
      categoryFilter: "unknown",
    }),
  ).toEqual([review]);
  expect(buyLaterBatch([unchecked, review, different], new Set())).toEqual([]);
});
it("shows unchecked counts separately in a real result summary", () => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(
    <ResultSummaryBar
      result={
        {
          total: 2,
          tracks: [base, { ...base, title: "Second" }],
          hasRekordboxData: false,
        } as ResultState
      }
      ownedCount={0}
      toBuyCount={0}
      unknownCount={2}
    />,
  );
  const counts = Object.fromEntries(
    [...host.querySelectorAll("dl > div")].map((x) => [
      x.querySelector("dt")!.textContent,
      x.querySelector("dd")!.textContent,
    ]),
  );
  expect(counts["Not checked"]).toBe("2");
  expect(counts["Needs review"]).toBe("0");
});
it("explains duplicate rows, already-saved recordings and exclusions independently", () => {
  const eligible = { ...base, owned: false };
  const saved = { ...eligible, title: "Saved" };
  const queued = new Set([recordingKey(saved)]);
  expect(
    buyLaterBatchSummary([eligible, eligible, saved, base], queued),
  ).toEqual({ duplicates: 1, saved: 1, excluded: 1 });
  expect(buyLaterBatch([eligible, eligible, saved, base], queued)).toHaveLength(
    1,
  );
});
it("exposes real determinate progress, indeterminate fetching and clamps invalid values", () => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(
    <ProcessingBar
      analyzing
      reanalyzing={false}
      progress={0}
      phaseLabel="Matching rekordbox"
    />,
  );
  expect(
    host.querySelector("[role=progressbar]")?.getAttribute("aria-valuenow"),
  ).toBe("0");
  host.innerHTML = renderToStaticMarkup(
    <ProcessingBar
      analyzing
      reanalyzing={false}
      progress={90}
      phaseLabel="Fetching Spotify..."
    />,
  );
  expect(
    host.querySelector("[role=progressbar]")?.hasAttribute("aria-valuenow"),
  ).toBe(false);
  host.innerHTML = renderToStaticMarkup(
    <ProcessingBar analyzing reanalyzing={false} progress={200} />,
  );
  expect(
    host.querySelector("[role=progressbar]")?.getAttribute("aria-valuenow"),
  ).toBe("100");
});
it("keeps full mix names and artist credits available without hover or truncation", () => {
  const title = "非常に長い曲名 ".repeat(12) + "Extended Club Remix";
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(
    <TrackIdentity
      track={{ ...base, title, artist: "Multiple Artists ".repeat(15) }}
    />,
  );
  expect(host.textContent).toContain(title);
  expect(host.querySelector("[title]")?.className).not.toMatch(
    /line-clamp|truncate/,
  );
  expect(
    [...host.querySelectorAll("p")].every(
      (x) => !x.className.includes("truncate"),
    ),
  ).toBe(true);
});
