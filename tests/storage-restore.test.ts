import { describe, it, expect } from "vitest";
import {
  STORAGE_RESULTS,
  restoreResultsFromStorage,
  normalizeStoredResults,
  safeJsonParse,
} from "@/lib/state/usePlaylistAnalyzer";

type StorageLike = {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
  removed: string[];
};

function makeStorage(initial?: Record<string, string>): StorageLike {
  const store = new Map<string, string>(Object.entries(initial ?? {}));
  const removed: string[] = [];
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => {
      removed.push(k);
      store.delete(k);
    },
    removed,
  };
}

describe("safeJsonParse", () => {
  it("returns null for invalid JSON", () => {
    expect(safeJsonParse("{oops")).toBeNull();
  });
});

describe("normalizeStoredResults", () => {
  it("accepts v2 format and returns tracks as []", () => {
    const parsed = {
      version: 2,
      results: [
        {
          url: "https://example.invalid/p/1",
          summary: { title: "t", total: 3, analyzedAt: 1 },
        },
      ],
    };
    const out = normalizeStoredResults(parsed);
    expect(out).not.toBeNull();
    expect(out!.length).toBe(1);
    expect(out![0][0]).toBe("https://example.invalid/p/1");
    expect(out![0][1].title).toBe("t");
    expect(out![0][1].total).toBe(3);
    expect(Array.isArray(out![0][1].tracks)).toBe(true);
    expect(out![0][1].tracks).toEqual([]);
  });

  it("accepts legacy tuple format and arrayifies tracks", () => {
    const parsed = {
      results: [
        [
          "https://example.invalid/p/2",
          { title: "t2", total: 1, tracks: [{ any: "ok" }] },
        ],
      ],
    };
    const out = normalizeStoredResults(parsed);
    expect(out).not.toBeNull();
    expect(out![0][1].title).toBe("t2");
    expect(out![0][1].total).toBe(1);
    expect(Array.isArray(out![0][1].tracks)).toBe(true);
    expect(out![0][1].tracks.length).toBe(1);
  });
});

describe("restoreResultsFromStorage", () => {
  it("restores v2 payload", () => {
    const storage = makeStorage({
      [STORAGE_RESULTS]: JSON.stringify({
        version: 2,
        results: [{ url: "u", summary: { title: "x", total: 2 } }],
      }),
    });

    const restored = restoreResultsFromStorage(storage);
    expect(restored).not.toBeNull();
    expect(restored!.length).toBe(1);
    expect(restored![0][0]).toBe("u");
    expect(restored![0][1].title).toBe("x");
    expect(storage.removed).toEqual([]);
  });

  it("discards unrecognized payload and removes key (schema mismatch / fallback)", () => {
    const storage = makeStorage({
      [STORAGE_RESULTS]: JSON.stringify({ foo: "bar" }),
    });

    const restored = restoreResultsFromStorage(storage);
    expect(restored).toBeNull();
    expect(storage.removed).toEqual([STORAGE_RESULTS]);
  });

  it("discards invalid JSON and removes key", () => {
    const storage = makeStorage({
      [STORAGE_RESULTS]: "{not-json",
    });

    const restored = restoreResultsFromStorage(storage);
    expect(restored).toBeNull();
    expect(storage.removed).toEqual([STORAGE_RESULTS]);
  });
});

describe("ownership snapshot restoration", () => {
  const track = {
    index: 1,
    title: "Song",
    artist: "Artist",
    album: "Album",
    stores: {},
    owned: true,
    ownedReason: "exact",
  };
  it("preserves the checked recording and XML information under current rules", () => {
    const result = normalizeStoredResults({
      version: 3,
      results: [
        {
          url: "u",
          tracks: [track],
          summary: {
            title: "P",
            total: 1,
            hasRekordboxData: true,
            rekordboxMeta: { filename: "library.xml" },
            meta: { ownership_rules_version: 3 },
          },
        },
      ],
    })!;
    expect(result[0][1].tracks[0].owned).toBe(true);
    expect(result[0][1].rekordboxMeta?.filename).toBe("library.xml");
  });
  it("does not retain ownership claims from stale matching rules", () => {
    const result = normalizeStoredResults({
      version: 3,
      results: [
        {
          url: "u",
          tracks: [track],
          summary: {
            title: "P",
            total: 1,
            hasRekordboxData: true,
            rekordboxMeta: { filename: "old.xml" },
            meta: { ownership_rules_version: 2 },
          },
        },
      ],
    })!;
    expect(result[0][1].tracks[0].owned).toBeNull();
    expect(result[0][1].hasRekordboxData).toBe(false);
    expect(result[0][1].rekordboxMeta).toBeNull();
  });
});
