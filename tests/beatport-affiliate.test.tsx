import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  withBeatportAid,
  beatportDestination,
} from "@/lib/affiliates/beatport";
import { purchaseLinks, safeStoreUrl } from "@/lib/domain/purchaseLinks";
import BuyLaterPanel from "@/app/components/BuyLaterPanel";
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
    const destination = new URL(url.searchParams.get("desturl")!);
    expect(url.hostname).toBe("pluginboutique.postaffiliatepro.com");
    expect(url.searchParams.get("a_cid")).toBe("0be88686");
    expect(destination.searchParams.has("a_aid")).toBe(false);
    expect(destination.searchParams.get("q")).toBe("artist");
    expect(destination.hash).toBe("#tracks");
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
    expect(beatport.hostname).toBe("pluginboutique.postaffiliatepro.com");
    expect(
      new URL(beatport.searchParams.get("desturl")!).searchParams.get("q"),
    ).toBe("Artist A & B");
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
    expect(new URL(direct.searchParams.get("desturl")!).pathname).toBe(
      "/track/example/123",
    );
    expect(direct.searchParams.get("a_aid")).toBe("our-id");
  });
});

describe("official Beatport Store deeplinks", () => {
  const official =
    "https://pluginboutique.postaffiliatepro.com/scripts/hfwq3c89wu2?a_aid=693b110f35af1&desturl=https%3A%2F%2Fwww.beatport.com%2Fsearch%3Fq%3DBAKEY%26type%3Dtracks&a_cid=0be88686";
  it("matches the account's official generator output exactly", () => {
    expect(
      withBeatportAid(
        "https://www.beatport.com/search?q=BAKEY&type=tracks",
        "693b110f35af1", // pragma: allowlist secret -- public affiliate referral ID, not a credential
      ),
    ).toBe(official);
    expect(withBeatportAid(official, "693b110f35af1")).toBe(official); // pragma: allowlist secret -- public referral ID
  });
  it("preserves Unicode, ampersands, versions and ISRCs without double encoding", () => {
    vi.stubEnv("NEXT_PUBLIC_BEATPORT_A_AID", "our-id");
    for (const isrc of [undefined, "GBTEST1234567"]) {
      const link = purchaseLinks({
        title: "曲 & Song (DJ Remix)",
        artist: "A + B",
        isrc,
      })[0];
      const destination = beatportDestination(link.url)!;
      expect(destination.searchParams.get("q")).toBe(
        isrc || "A + B 曲 & Song (DJ Remix)",
      );
      expect(destination.searchParams.get("type")).toBe("tracks");
    }
  });
  it("restores product destinations and reapplies current attribution in Buy Later", () => {
    vi.stubEnv("NEXT_PUBLIC_BEATPORT_A_AID", "new-id");
    const saved = withBeatportAid(
      "https://www.beatport.com/track/example/123",
      "old-id",
    );
    const link = purchaseLinks({
      title: "Song",
      artist: "Artist",
      stores: { beatport: saved },
    })[0];
    expect(link.label).toBe("Beatport track page");
    expect(new URL(link.url).searchParams.get("a_aid")).toBe("new-id");
    expect(beatportDestination(link.url)?.pathname).toBe("/track/example/123");
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(
      <BuyLaterPanel
        items={[
          {
            id: "1",
            title: "Song",
            artist: "Artist",
            buyStore: "Beatport",
            buyUrl: saved,
          },
        ]}
        onRemove={() => {}}
      />,
    );
    const anchor = [...host.querySelectorAll("a")].find(
      (a) => a.textContent === "Beatport track page",
    )!;
    expect(anchor).toBeTruthy();
    expect(anchor.href).toBe(link.url);
  });
  it("rejects lookalike trackers, unsafe destinations and nested redirects", () => {
    const targets = [
      "https://evil.test/",
      "http://www.beatport.com/",
      "https://www.beatport.com.evil.test/",
      official,
    ];
    for (const destination of targets) {
      const redirect = new URL(official);
      redirect.searchParams.set("desturl", destination);
      expect(safeStoreUrl(redirect.toString(), "Beatport")).toBeNull();
    }
    expect(
      safeStoreUrl(
        official.replace(
          "postaffiliatepro.com",
          "postaffiliatepro.com.evil.test",
        ),
        "Beatport",
      ),
    ).toBeNull();
    expect(
      safeStoreUrl(official.replace("/hfwq3c89wu2", "/other"), "Beatport"),
    ).toBeNull();
    expect(
      safeStoreUrl(
        official.replace("https://", "https://user:pass@"), // pragma: allowlist secret -- synthetic credential rejection fixture
        "Beatport",
      ),
    ).toBeNull();
  });
});
