import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { normalizeTracks } from "@/lib/api/normalize";
import { selectDisplayedTracks, selectTrackCounts } from "@/lib/ui/selectors";
import ResultsTable from "@/app/components/ResultsTable";
import ResultSummaryBar from "@/app/components/ResultSummaryBar";
import type { PlaylistRow, ResultState } from "@/lib/types";

const tracks = normalizeTracks({
  tracks: [
    { title: "Owned", artist: "Artist", owned: true },
    { title: "Missing", artist: "Artist", owned: false },
    { title: "Unknown null", artist: "Artist", owned: null },
    { title: "Unknown absent", artist: "Artist" },
  ],
});

describe("three-state ownership results", () => {
  it("preserves missing ownership through the API boundary", () => {
    expect(tracks.map((t) => t.owned)).toEqual([true, false, null, null]);
  });
  it("counts and filters unverified tracks separately from purchase candidates", () => {
    expect(selectTrackCounts(tracks)).toEqual({
      ownedCount: 1,
      toBuyCount: 1,
      unknownCount: 2,
    });
    const select = (categoryFilter: "all" | "toBuy" | "owned" | "unknown") =>
      selectDisplayedTracks(tracks, {
        categoryFilter,
        searchQuery: "",
        sortKey: "none",
      });
    expect(select("toBuy").map((t) => t.title)).toEqual(["Missing"]);
    expect(select("unknown")).toHaveLength(2);
    expect(select("owned")).toHaveLength(1);
    expect(select("all")).toHaveLength(4);
    expect(selectTrackCounts([{ ...tracks[0], owned: undefined }])).toEqual({
      ownedCount: 0,
      toBuyCount: 0,
      unknownCount: 1,
    });
  });
  it("allows Buy Later only for confirmed unowned tracks on mobile and desktop", () => {
    for (const owned of [true, false, null, undefined]) {
      const track: PlaylistRow = { ...tracks[0], owned };
      const container = document.createElement("div");
      container.innerHTML = renderToStaticMarkup(
        <ResultsTable
          currentResult={{}}
          displayedTracks={[track]}
          onAddToBuyQueue={() => {}}
        />,
      );
      const saves = Array.from(container.querySelectorAll("button")).filter(
        (b) => b.textContent === "Buy Later",
      );
      expect(saves).toHaveLength(owned === false ? 2 : 0);
      if (owned == null) expect(container.textContent).toContain("Not checked");
    }
  });
  it("explains why unverified tracks are excluded from To buy", () => {
    const html = renderToStaticMarkup(
      <ResultSummaryBar
        result={{ total: 4 } as ResultState}
        ownedCount={1}
        toBuyCount={1}
        unknownCount={2}
      />,
    );
    expect(html).toContain("2 need review");
    expect(html).toContain("excluded from Not in XML");
  });
});

it("shows export scope and candidate evidence without claiming global ownership", () => {
  const result = {
    total: 1,
    hasRekordboxData: true,
    rekordboxMeta: { filename: "partial.xml" },
    meta: {
      rekordbox: {
        scope: "selected_xml",
        library_track_count: 123,
        library_sha256: "fingerprint",
        matched_at: "2026-11-03T00:00:00Z",
      },
    },
  } as ResultState;
  const summary = renderToStaticMarkup(
    <ResultSummaryBar
      result={result}
      ownedCount={0}
      toBuyCount={1}
      unknownCount={0}
    />,
  );
  expect(summary).toContain("not proof that you do not own");
  expect(summary).toContain("123 library entries");
  expect(summary).toContain("partial.xml");
  const html = renderToStaticMarkup(
    <ResultsTable
      currentResult={result}
      displayedTracks={[
        {
          ...tracks[0],
          owned: null,
          ownedReason: "version_mismatch",
          libraryMatch: {
            status: "review",
            reason: "version_mismatch",
            matched_title: "Song (Other Remix)",
            matched_artist: "Artist",
          },
        },
      ]}
    />,
  );
  const rendered = document.createElement("div");
  rendered.innerHTML = html;
  expect(rendered.textContent).toContain("Song (Other Remix)");
  expect(html).toContain("Needs review");
  expect(html).toContain("Matching details");
});
