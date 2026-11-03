import type { PlaylistRow } from "../types";
import { purchaseLinks } from "./purchaseLinks";
import { effectiveOwned, libraryMatchLabel } from "./libraryMatch";

export type PortablePurchase = Pick<
  PlaylistRow,
  "title" | "artist" | "isrc"
> & { status: string; stores?: PlaylistRow["stores"] };
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function portableTracks(tracks: PlaylistRow[]): PortablePurchase[] {
  return tracks
    .filter((track) => effectiveOwned(track) !== true)
    .map((track) => ({
      title: track.title,
      artist: track.artist,
      isrc: track.isrc,
      stores: track.stores,
      status: libraryMatchLabel(track),
    }));
}
export function purchaseDocument(
  items: PortablePurchase[],
  createdAt = new Date().toISOString(),
): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Playlist Shopper — purchase candidates</title><style>body{font:16px system-ui;line-height:1.6;max-width:800px;margin:auto;padding:24px;color:#17202a;background:#fafafa}li{border-top:1px solid #ccc;padding:20px 0;overflow-wrap:anywhere}ul{list-style:none;padding:0}a{display:inline-block;padding:12px;margin:4px;border:1px solid #777;border-radius:8px;color:#143c75}a:first-of-type{background:#173c31;color:white}small{display:block;color:#555}</style></head><body><h1>Purchase candidates (${items.length})</h1><p>Saved ${escape(createdAt)}. Ownership labels are a snapshot, not a fresh library check. Search links do not confirm availability. Track pages do not confirm the same mix or version. Compare before buying.</p><p>This file contains song details and links, without your XML or library. Send it to your phone and open it in a browser. Anyone with the file can read this list.</p><ul>${items
    .map(
      (item) =>
        `<li><strong>${escape(item.title)}</strong><div>${escape(item.artist)}</div><small>${escape(item.status)}${item.isrc ? ` · ISRC: ${escape(item.isrc)}` : ""}</small>${purchaseLinks(
          item,
        )
          .map(
            (link) =>
              `<a href="${escape(link.url)}" target="_blank" rel="noopener noreferrer">${escape(link.label)}</a>`,
          )
          .join(
            "",
          )}<small>Beatport first · Bandcamp alternative. Product version unverified.</small></li>`,
    )
    .join("")}</ul></body></html>`;
}
export function downloadPurchases(items: PortablePurchase[]) {
  const url = URL.createObjectURL(
    new Blob([purchaseDocument(items)], { type: "text/html;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "playlist-purchase-candidates.html";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
