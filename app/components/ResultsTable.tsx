"use client";

import React from "react";
import type { PlaylistRow, StoreLinks } from "../../lib/types";
import { getRecommendedStore, getOtherStores } from "../../lib/playlist/stores";

type Props = {
  currentResult: unknown | null;
  displayedTracks: PlaylistRow[];

  // page.tsx が渡してくる余計な props を許容（互換のため）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

function firstStoreUrl(stores?: StoreLinks): string {
  const s = stores ?? ({} as StoreLinks);
  return (s.beatport ?? "") || (s.bandcamp ?? "") || (s.itunes ?? "") || "";
}

function beatportSearchUrl(track: PlaylistRow): string {
  const q = `${track.artist ?? ""} ${track.title ?? ""}`.trim();
  return "";
}

function StoreLinksInline({ track }: { track: PlaylistRow }) {
  const recommended = getRecommendedStore(track);
  const others = getOtherStores(track.stores, recommended);
  const primaryUrl = recommended?.url || firstStoreUrl(track.stores);
  const fallback = beatportSearchUrl(track);

  const mainLabel = primaryUrl ? (recommended?.name ?? "Buy") : "Search";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={primaryUrl || "#"}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center rounded-md bg-white/10 px-2 py-1 text-[11px] text-white hover:bg-white/15"
        title={primaryUrl ? "Open store" : "No store link"}
      >
        {mainLabel}
      </a>

      {others.map((s) => (
        <a
          key={s.name}
          href={s.url}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-white/60 hover:text-white"
        >
          {s.name}
        </a>
      ))}
    </div>
  );
}

export default function ResultsTable({ currentResult, displayedTracks }: Props) {
  if (!currentResult) return null;
  const rows = Array.isArray(displayedTracks) ? displayedTracks : [];

  return (
    <div className="mt-4 space-y-2">
      <div className="md:hidden space-y-2">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-white/50 text-center">
            No tracks
          </div>
        ) : (
          rows.map((t, i) => (
            <div
              key={`${t?.isrc ?? ""}-${i}`}
              className="rounded-xl border border-white/10 bg-white/5 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white truncate">{t?.title ?? ""}</div>
                  <div className="text-xs text-white/70 truncate">{t?.artist ?? ""}</div>
                  <div className="text-xs text-white/50 truncate">{t?.album ?? ""}</div>
                </div>
                <div className="shrink-0 text-[11px] text-white/40">{t?.isrc ?? ""}</div>
              </div>
              <div className="mt-2">
                <StoreLinksInline track={t} />
              </div>
            </div>
          ))
        )}
      </div>

      <div className="hidden md:block rounded-2xl border border-white/10 overflow-x-auto">
        <table className="min-w-[980px] w-full text-xs">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="px-3 py-2 text-left">Title</th>
              <th className="px-3 py-2 text-left">Artist</th>
              <th className="px-3 py-2 text-left">Album</th>
              <th className="px-3 py-2 text-left">ISRC</th>
              <th className="px-3 py-2 text-left">Buy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.map((t, i) => (
              <tr key={`${t?.isrc ?? ""}-${i}`} className="hover:bg-white/5">
                <td className="px-3 py-2 text-white">{t?.title ?? ""}</td>
                <td className="px-3 py-2 text-white/80">{t?.artist ?? ""}</td>
                <td className="px-3 py-2 text-white/60">{t?.album ?? ""}</td>
                <td className="px-3 py-2 text-white/40">{t?.isrc ?? ""}</td>
                <td className="px-3 py-2">
                  <StoreLinksInline track={t} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
