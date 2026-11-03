import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, vi } from "vitest";
import { recordingKey } from "@/lib/domain/recordingIdentity";
import {
  applyReviewDecisions,
  useReviewDecisions,
} from "@/lib/state/useReviewDecisions";
import { withPlaylistChanges } from "@/lib/domain/playlistChanges";
import { buildPurchasePlan } from "@/lib/domain/purchasePlan";
import { effectiveOwned } from "@/lib/domain/libraryMatch";
import { selectDisplayedTracks } from "@/lib/ui/selectors";
import type { PlaylistRow, ResultState } from "@/lib/types";
const row = (
  title = "Song",
  props: Partial<PlaylistRow> = {},
): PlaylistRow => ({
  index: 1,
  title,
  artist: "A & B",
  album: "Album",
  stores: {},
  owned: false,
  ...props,
});
const result = (
  tracks: PlaylistRow[],
  fingerprint = "xml",
  id = "p",
): ResultState => ({
  title: id,
  total: tracks.length,
  playlistUrl: id,
  playlist_id: id,
  tracks,
  analyzedAt: 1,
  hasRekordboxData: true,
  meta: {
    ownership_rules_version: 4,
    rekordbox: { library_sha256: fingerprint },
  },
});
describe("remembered review decisions", () => {
  it("keeps automatic evidence intact and never transfers a confirmation to another version", () => {
    const track = row("Song (Alice Remix)");
    const decisions = {
      [recordingKey(track)]: { action: "owned" as const, updatedAt: "now" },
    };
    const [applied] = applyReviewDecisions([track], decisions, "xml", 4);
    expect(applied.owned).toBe(false);
    expect(effectiveOwned(applied)).toBe(true);
    expect(
      effectiveOwned(
        applyReviewDecisions([row("Song (Bob Remix)")], decisions, "xml", 4)[0],
      ),
    ).toBe(false);
  });
  it("invalidates a different-version rejection when XML, candidate or matching rules change", () => {
    const track = row("Song", {
      owned: true,
      ownedReason: "exact",
      libraryMatch: {
        status: "matched",
        reason: "exact",
        matched_title: "Song",
        matched_artist: "A & B",
      },
    });
    const candidate = JSON.stringify(["Song", "A & B", "exact"]);
    const decisions = {
      [recordingKey(track)]: {
        action: "different_version" as const,
        updatedAt: "now",
        libraryFingerprint: "xml",
        candidate,
        rulesVersion: 4,
      },
    };
    expect(
      effectiveOwned(applyReviewDecisions([track], decisions, "xml", 4)[0]),
    ).toBeNull();
    expect(
      effectiveOwned(applyReviewDecisions([track], decisions, "new", 4)[0]),
    ).toBe(true);
    expect(
      effectiveOwned(applyReviewDecisions([track], decisions, "xml", 5)[0]),
    ).toBe(true);
    expect(
      effectiveOwned(
        applyReviewDecisions(
          [
            {
              ...track,
              libraryMatch: { ...track.libraryMatch!, matched_title: "Other" },
            },
          ],
          decisions,
          "xml",
          4,
        )[0],
      ),
    ).toBe(true);
  });
  it("saves, restores and explicitly forgets a confirmation; failed saves do not show success", async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    const div = document.createElement("div");
    const root = createRoot(div);
    let state!: ReturnType<typeof useReviewDecisions>;
    function Harness() {
      const value = useReviewDecisions();
      useEffect(() => {
        state = value;
      }, [value]);
      return null;
    }
    try {
      await act(async () => {
        root.render(<Harness />);
      });
      act(() => state.decide(row(), "owned", "xml", 4));
      expect(state.decisions[recordingKey(row())].action).toBe("owned");
      act(() => state.decide(row(), null));
      expect(state.decisions).toEqual({});
      const spy = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(() => {
          throw new Error("full");
        });
      act(() => state.decide(row(), "owned", "xml", 4));
      expect(state.decisions).toEqual({});
      expect(state.warning).toContain("could not be saved");
      spy.mockRestore();
    } finally {
      act(() => root.unmount());
      vi.restoreAllMocks();
      localStorage.clear();
    }
  });
});
describe("playlist differences", () => {
  it("counts additions, metadata changes and removals without treating reordering as change", () => {
    const old = result([
      row("A", { spotifyUrl: "https://open.spotify.com/track/one" }),
      row("B"),
      row("Removed"),
    ]);
    const next = result([
      row("B", { index: 1 }),
      row("A", {
        index: 2,
        album: "New",
        spotifyUrl: "https://open.spotify.com/track/one",
      }),
      row("Added", { index: 3 }),
    ]);
    const diff = withPlaylistChanges(next, old);
    expect(diff.changeSummary).toEqual({
      hasPrevious: true,
      added: 1,
      changed: 1,
      rechecked: 0,
      removed: 1,
      unchanged: 1,
    });
    expect(
      selectDisplayedTracks(diff.tracks, {
        changesOnly: true,
        categoryFilter: "all",
        searchQuery: "",
        sortKey: "none",
      }),
    ).toHaveLength(2);
  });
  it("rechecks unchanged rows when XML or rules change and counts duplicate occurrences", () => {
    const old = result([row(), row()]);
    const diff = withPlaylistChanges(result([row()], "different"), old);
    expect(diff.changeSummary?.rechecked).toBe(1);
    expect(diff.changeSummary?.removed).toBe(1);
  });
});
describe("combined purchase plan", () => {
  it("deduplicates recordings, counts playlists once, and keeps remixes separate", () => {
    const a = row("Song (Alice Remix)");
    const b = row("Song (Bob Remix)");
    const plan = buildPurchasePlan([
      ["p1", result([a, a, b], "xml", "p1")],
      ["p2", result([a], "xml", "p2")],
    ]);
    expect(plan).toHaveLength(2);
    expect(plan[0].playlists).toHaveLength(2);
  });
  it("does not suggest buying a recording owned or unresolved in another loaded playlist", () => {
    const missing = row();
    expect(
      buildPurchasePlan([
        ["a", result([missing])],
        [
          "b",
          result([
            {
              ...missing,
              reviewDecision: { action: "owned", updatedAt: "now" },
            },
          ]),
        ],
      ]),
    ).toEqual([]);
    expect(
      buildPurchasePlan([
        ["a", result([missing])],
        ["b", result([{ ...missing, owned: null }])],
      ]),
    ).toEqual([]);
  });
});
