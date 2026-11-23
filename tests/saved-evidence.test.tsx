import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { recordingKey } from "@/lib/domain/recordingIdentity";
import { expect, it } from "vitest";
import BuyLaterPanel from "@/app/components/BuyLaterPanel";
import {
  captureQueueEvidence,
  latestQueueEvidence,
  parseQueueEvidence,
} from "@/lib/domain/buyQueueEvidence";
import type { PlaylistRow } from "@/lib/types";
const track: PlaylistRow = {
  index: 0,
  title: "Saved song",
  artist: "Artist",
  album: "Album",
  stores: {},
  owned: false,
  libraryMatch: { status: "not_found", reason: "no_match" },
};
const context = {
  checkedAt: "2026-11-23T10:00:00.000Z",
  xmlFilename: "collection.xml",
  rulesVersion: 5,
  libraryFingerprint: "one",
};
const item = {
  id: "song",
  title: "Saved song",
  artist: "Artist",
  buyUrl: "https://www.beatport.com/search?q=song",
  buyStore: "Beatport",
};
it("captures an independent evidence snapshot and handles legacy or malformed evidence", () => {
  const evidence = captureQueueEvidence(track, context)!;
  const original = JSON.stringify(track);
  expect(evidence).toMatchObject({
    owned: false,
    xmlFilename: "collection.xml",
    rulesVersion: 5,
  });
  evidence.libraryMatch!.reason = "changed";
  expect(JSON.stringify(track)).toBe(original);
  expect(captureQueueEvidence(track)).toBeUndefined();
  expect(parseQueueEvidence({ owned: "yes" })).toBeUndefined();
});
it("never invents a verdict for a legacy saved item", () => {
  const html = renderToStaticMarkup(
    <BuyLaterPanel items={[item]} onRemove={() => {}} />,
  );
  expect(html).toContain("No saved matching evidence");
  expect(html).toContain("Check it with your XML before buying");
});
it("shows newer matching evidence, its library scope and the original saved decision", () => {
  const evidence = captureQueueEvidence(track, context)!;
  const current = captureQueueEvidence(
    {
      ...track,
      owned: null,
      ownedReason: "missing_artist",
      libraryMatch: {
        status: "review",
        reason: "missing_artist",
        matched_title: "Saved song",
        matched_artist: "",
      },
    },
    {
      ...context,
      checkedAt: "2026-11-23T11:00:00.000Z",
      libraryFingerprint: "two",
    },
  )!;
  const html = renderToStaticMarkup(
    <BuyLaterPanel
      items={[{ ...item, evidence, currentEvidence: current }]}
      onRemove={() => {}}
    />,
  );
  expect(html).toContain("Needs review");
  expect(html).toContain("artist information is missing");
  expect(html).toContain("A newer matching result is shown");
  expect(html).toContain("Saved decision:");
  expect(html).toContain("collection.xml");
});
it("asks for a fresh check when a saved verdict used older rules", () => {
  const html = renderToStaticMarkup(
    <BuyLaterPanel
      items={[
        {
          ...item,
          evidence: captureQueueEvidence(track, {
            ...context,
            rulesVersion: 4,
          }),
        },
      ]}
      onRemove={() => {}}
    />,
  );
  expect(html).toContain("Needs recheck");
  expect(html).toContain("older matching rules");
});

it("selects the latest available result independently of history order", () => {
  const result = (at: string, owned: boolean) =>
    ({
      tracks: [{ ...track, owned }],
      meta: {
        ownership_rules_version: 5,
        rekordbox: { matched_at: at, library_sha256: "one" },
      },
    }) as import("@/lib/types").ResultState;
  const rows: Array<[string, import("@/lib/types").ResultState]> = [
    ["old", result("2026-11-23T10:00:00.000Z", false)],
    ["new", result("2026-11-23T11:00:00.000Z", true)],
  ];
  const key = recordingKey(track);
  expect(latestQueueEvidence(rows, new Set([key])).get(key)?.owned).toBe(true);
});
