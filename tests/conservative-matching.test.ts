import { expect, it } from "vitest";
import {
  matchLibrary,
  LOCAL_RULES_VERSION,
} from "@/lib/rekordbox/localMatcher";
import { parseLibraryXml } from "@/lib/rekordbox/prepareXmlUpload";
import { normalizeStoredResults } from "@/lib/storage/analysisHistory";
const song = {
  title: "Example Song",
  artist: "Example Artist",
  album: "",
  duration_ms: 180000,
};
it("keeps missing artist/title-only candidates in review, even with equal duration", () => {
  const row = matchLibrary([song], [{ ...song, artist: "" }])[0];
  expect(row.owned).toBeNull();
  expect(row.owned_reason).toBe("missing_artist");
  expect(row.library_match.matched_duration_ms).toBe(180000);
});
it("does not auto-confirm guessed artist credits in file titles", () => {
  expect(
    matchLibrary(
      [{ ...song, title: "Song", artist: "Artist" }],
      [{ title: "Artist - Song", artist: "", album: "" }],
    )[0].owned,
  ).toBeNull();
});
it("recovers soundtrack subtitles for review without merging remixes or unrelated artists", () => {
  const row = matchLibrary(
    [{ ...song, title: "Example Song - From Example Soundtrack" }],
    [song],
  )[0];
  expect(row.owned).toBeNull();
  expect(row.owned_reason).toBe("subtitle_mismatch");
  expect(
    matchLibrary([song], [{ ...song, artist: "Different Artist" }])[0].owned,
  ).toBe(false);
  expect(
    matchLibrary([song], [{ ...song, title: "Example Song (Other Remix)" }])[0]
      .owned,
  ).toBeNull();
});
it("uses duration as cautionary evidence, never ownership proof", () => {
  expect(
    matchLibrary([song], [{ ...song, duration_ms: 240000 }])[0].owned_reason,
  ).toBe("duration_mismatch");
  expect(
    matchLibrary(
      [{ ...song, isrc: "ABC" }],
      [{ ...song, artist: "", isrc: "ABC" }],
    )[0].owned,
  ).toBe(true);
  expect(
    matchLibrary(
      [song],
      [{ ...song, title: "Unrelated Song", artist: "", duration_ms: 180000 }],
    )[0].owned,
  ).toBe(false);
});
it("retains XML duration without retaining file paths", () => {
  const entries = parseLibraryXml(
    '<DJ_PLAYLISTS><COLLECTION><TRACK Name="Song" Artist="" TotalTime="180" Location="file:///private/music.wav"/><TRACK Name="Other" TotalTime="invalid"/></COLLECTION></DJ_PLAYLISTS>',
  );
  expect(entries[0].duration_ms).toBe(180000);
  expect(entries[1].duration_ms).toBeUndefined();
  expect(JSON.stringify(entries)).not.toContain("private");
});
it("requires rechecking old absent results while retaining current rules and raw metadata", () => {
  const row = {
    index: 0,
    title: "Song",
    artist: "A",
    album: "",
    stores: {},
    owned: false,
  };
  const restore = (rules: number) =>
    normalizeStoredResults({
      version: 3,
      results: [
        {
          url: "u",
          summary: {
            hasRekordboxData: true,
            meta: { ownership_rules_version: rules },
          },
          tracks: [row],
        },
      ],
    })![0][1];
  expect(restore(4).tracks[0]).toMatchObject({
    title: "Song",
    owned: null,
    ownedReason: "outdated_rules",
  });
  expect(restore(LOCAL_RULES_VERSION).tracks[0].owned).toBe(false);
});
