import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { withBeatportAid } from "@/lib/affiliates/beatport";
import type { PlaylistRow } from "@/lib/types";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Beatport attribution", () => {
  it("replaces stale attribution while preserving search parameters and fragments", () => {
    const url = new URL(
      withBeatportAid(
        "https://www.beatport.com/search?q=artist&a_aid=old#tracks",
        "our-id",
      ),
    );
    expect(url.searchParams.getAll("a_aid")).toEqual(["our-id"]);
    expect(url.searchParams.get("q")).toBe("artist");
    expect(url.hash).toBe("#tracks");
  });

  it("reads the configured ID for previously saved links", () => {
    vi.stubEnv("NEXT_PUBLIC_BEATPORT_A_AID", "our-id");
    expect(
      new URL(
        withBeatportAid("https://beatport.com/track/example/123"),
      ).searchParams.get("a_aid"),
    ).toBe("our-id");
  });

  it("leaves other hosts, invalid URLs, and unconfigured links unchanged", () => {
    for (const url of [
      "https://bandcamp.com/search?q=x",
      "https://beatport.com.evil.test/",
      "invalid",
    ]) {
      expect(withBeatportAid(url, "our-id")).toBe(url);
    }
    expect(withBeatportAid("https://beatport.com/search?q=x", "")).toBe(
      "https://beatport.com/search?q=x",
    );
  });

  it("renders attributed search fallbacks and preserves direct product links", async () => {
    vi.stubEnv("NEXT_PUBLIC_BEATPORT_A_AID", "our-id");
    const { default: ResultsTable } =
      await import("@/app/components/ResultsTable");
    const track = {
      index: 1,
      title: "A & B",
      artist: "Artist",
      owned: false,
      stores: {},
    } as PlaylistRow;
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(
      <ResultsTable currentResult={{}} displayedTracks={[track]} />,
    );
    const links = Array.from(container.querySelectorAll("a"));
    const beatport = new URL(
      links.find((a) => a.textContent === "Search Beatport")!.href,
    );
    expect(beatport.hostname).toBe("beatport.com");
    expect(beatport.searchParams.get("q")).toBe("Artist A & B");
    expect(beatport.searchParams.get("a_aid")).toBe("our-id");
    expect(links.some((a) => new URL(a.href).hostname === "bandcamp.com")).toBe(
      true,
    );
    container.innerHTML = renderToStaticMarkup(
      <ResultsTable
        currentResult={{}}
        displayedTracks={[
          {
            ...track,
            stores: {
              beatport: "https://beatport.com/track/example/123?a_aid=old",
            },
          },
        ]}
      />,
    );
    const direct = new URL(
      Array.from(container.querySelectorAll("a")).find(
        (a) => a.textContent === "Beatport track page",
      )!.href,
    );
    expect(direct.pathname).toBe("/track/example/123");
    expect(direct.searchParams.get("a_aid")).toBe("our-id");
  });
});
