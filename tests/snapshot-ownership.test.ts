import { describe, expect, it } from "vitest";
import { applySnapshotOwnership } from "@/lib/playlist/snapshotOwnership";
import type { PlaylistRow } from "@/lib/types";

const original = {
  index: 1,
  title: "Song",
  artist: "Artist",
  album: "Album",
  stores: {},
  trackKeyPrimary: "same",
  owned: false,
} as PlaylistRow;
const remix = { ...original, index: 2, title: "Song - Remix" };
const untouched = { ...original, index: 3, title: "Other" };
const matched = (
  track: PlaylistRow,
  owned: boolean | null,
  reason: string | null,
) => ({
  title: track.title,
  artist: track.artist,
  album: track.album,
  owned,
  owned_reason: reason,
});

describe("XML snapshot ownership", () => {
  it("does not merge versions with the same normalized key", () => {
    const result = applySnapshotOwnership(
      [original, remix],
      [original, remix],
      [
        matched(original, true, "exact"),
        matched(remix, null, "version_mismatch"),
      ],
    );
    expect(result.map((t) => t.owned)).toEqual([true, null]);
    expect(result[1].ownedReason).toBe("version_mismatch");
  });
  it("handles filtered and reordered submissions without changing other rows", () => {
    const result = applySnapshotOwnership(
      [original, remix, untouched],
      [remix, original],
      [matched(remix, false, null), matched(original, true, "exact")],
    );
    expect(result.map((t) => t.owned)).toEqual([true, false, false]);
    expect(result[2]).toBe(untouched);
  });
  it("rejects missing or mismatched responses rather than guessing", () => {
    expect(() => applySnapshotOwnership([original], [original], [])).toThrow();
    expect(() =>
      applySnapshotOwnership(
        [original],
        [original],
        [matched(remix, true, "exact")],
      ),
    ).toThrow();
  });
});
