import { describe, it, expect } from "vitest";
import corpus from "./fixtures/local-matching.json";
import { matchLibrary } from "@/lib/rekordbox/localMatcher";
import {
  normalizeArtist,
  normalizeTitle,
  normalizeAlbum,
  artistIdentity,
  versionSignature,
  annotationSignature,
} from "@/lib/rekordbox/normalizer";
import { similarity } from "@/lib/rekordbox/similarity";
describe("browser matching agrees with Python reference", () => {
  it.each(corpus.cases.map((c, i) => ({ ...c, index: i })))(
    "matching case $index",
    (c) => {
      expect(matchLibrary(c.tracks, c.entries)).toEqual(c.expected);
    },
  );
  it.each(corpus.normalizers)("normalization: $value", (c) => {
    expect(normalizeArtist(c.value)).toBe(c.artist);
    expect(normalizeTitle(c.value)).toBe(c.title);
    expect(normalizeAlbum(c.value)).toBe(c.album);
    expect(artistIdentity(c.value)).toEqual(c.identity);
    expect(versionSignature(c.value)).toEqual(c.version);
    expect(annotationSignature(c.value)).toEqual(c.annotation);
  });
  it.each(corpus.similarity)("similarity: $left / $right", (c) => {
    expect(similarity(c.left, c.right)).toBeCloseTo(c.ratio, 12);
  });
});
