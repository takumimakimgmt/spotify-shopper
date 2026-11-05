import type { PlaylistRow } from "../types";
import { beatportDestination, withBeatportAid } from "../affiliates/beatport";

export type PurchaseLink = {
  name: string;
  url: string;
  label: string;
  product: boolean;
};
type Recording = Pick<PlaylistRow, "title" | "artist" | "isrc"> & {
  stores?: PlaylistRow["stores"];
};

/** A product URL identifies a page, not a verified recording match. */
export function safeStoreUrl(
  raw: string | undefined,
  store: "Beatport" | "Bandcamp",
): string | null {
  if (store === "Beatport")
    return beatportDestination(raw || "")?.toString() ?? null;
  try {
    const url = new URL(raw || "");
    const host = url.hostname.toLowerCase();
    const domain = "bandcamp.com";
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !(host === domain || host.endsWith(`.${domain}`))
    )
      return null;
    return url.toString();
  } catch {
    return null;
  }
}
export function purchaseLinks(track: Recording): PurchaseLink[] {
  const query = `${track.artist} ${track.title}`.trim();
  const beatport =
    safeStoreUrl(track.stores?.beatport, "Beatport") ||
    `https://beatport.com/search?${new URLSearchParams({ q: track.isrc || query, type: "tracks" })}`;
  const bandcamp =
    safeStoreUrl(track.stores?.bandcamp, "Bandcamp") ||
    `https://bandcamp.com/search?${new URLSearchParams({ q: query, item_type: "t" })}`;
  return (
    [
      ["Beatport", beatport],
      ["Bandcamp", bandcamp],
    ] as const
  ).map(([name, url]) => {
    const path = new URL(url).pathname;
    const product =
      name === "Beatport"
        ? /^\/track\/[^/]+\/\d+\/?$/.test(path)
        : /^\/track\/[^/]+\/?$/.test(path);
    return {
      name,
      url: name === "Beatport" ? withBeatportAid(url) : url,
      product,
      label: product ? `${name} track page` : `Search ${name}`,
    };
  });
}
