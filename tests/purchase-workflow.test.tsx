import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { purchaseLinks } from "@/lib/domain/purchaseLinks";
import {
  portableTracks,
  purchaseDocument,
} from "@/lib/domain/portablePurchases";
import RecordingComparison from "@/app/components/RecordingComparison";
import type { PlaylistRow } from "@/lib/types";
const track: PlaylistRow = {
  index: 1,
  title: "Song (Alice Remix)",
  artist: "Artist",
  album: "Album",
  stores: {},
  owned: false,
};
describe("purchase workflow", () => {
  it("keeps remix information in search and labels product pages without claiming verification", () => {
    const search = purchaseLinks(track)[0];
    expect(new URL(search.url).searchParams.get("q")).toBe(
      "Artist Song (Alice Remix)",
    );
    expect(search.label).toBe("Search Beatport");
    const product = purchaseLinks({
      ...track,
      stores: { beatport: "https://www.beatport.com/track/song/123" },
    })[0];
    expect(product.label).toBe("Beatport track page");
    expect(product).not.toHaveProperty("verified");
    expect(purchaseLinks(track)[1].name).toBe("Bandcamp");
  });
  it("rejects unsafe and unrelated saved links", () => {
    for (const url of [
      "javascript:alert(1)",
      "https://beatport.com.evil.test/track/song/123",
      "http://beatport.com/track/song/123",
      "https://user:password@beatport.com/track/song/123", // pragma: allowlist secret -- synthetic URL rejection fixture
    ]) {
      const link = purchaseLinks({ ...track, stores: { beatport: url } })[0];
      expect(link.label).toBe("Search Beatport");
      expect(new URL(link.url).hostname).toBe("beatport.com");
    }
  });
  it("highlights version and artist differences without changing matching evidence", () => {
    const row = {
      ...track,
      libraryMatch: {
        status: "review" as const,
        reason: "version_mismatch",
        matched_title: "Song (Bob Remix)",
        matched_artist: "Other Artist",
      },
    };
    const before = JSON.stringify(row);
    const div = document.createElement("div");
    div.innerHTML = renderToStaticMarkup(<RecordingComparison track={row} />);
    expect(div.textContent).toContain("Spotify recording");
    expect(div.textContent).toContain("XML candidate");
    expect(
      [...div.querySelectorAll("mark")].map((x) => x.textContent).join(" "),
    ).toContain("Bob");
    expect(div.textContent).toContain("Artist credits · differs");
    expect(JSON.stringify(row)).toBe(before);
  });
  it("exports only candidate snapshots and leaves unchecked rows explicitly unchecked", () => {
    const items = portableTracks([
      track,
      { ...track, owned: true },
      { ...track, reviewDecision: { action: "owned", updatedAt: "now" } },
      { ...track, owned: null },
    ]);
    expect(items).toHaveLength(2);
    expect(items[1].status).toBe("Not checked");
    expect(items[0]).not.toHaveProperty("libraryMatch");
    const html = purchaseDocument(items, "2026-11-03");
    expect(html).toContain('name="viewport"');
    expect(html).toContain("not a fresh library check");
    expect(html).toContain("Search Beatport");
  });
  it("escapes hostile metadata and never embeds executable scripts or unsafe store URLs", () => {
    const html = purchaseDocument([
      {
        ...track,
        title: "<script>alert(1)</script>",
        artist: "<img src=x onerror=alert(1)>",
        status: "Not checked",
        stores: { beatport: "javascript:alert(1)" },
      },
    ]);
    const document = new DOMParser().parseFromString(html, "text/html");
    expect(document.querySelectorAll("script,img,iframe")).toHaveLength(0);
    expect(document.querySelector("strong")?.textContent).toBe(
      "<script>alert(1)</script>",
    );
    expect(
      [...document.querySelectorAll("a")].every((a) => a.protocol === "https:"),
    ).toBe(true);
  });
});
