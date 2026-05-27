"use client";

import React from "react";
import type { PlaylistRow, StoreLinks } from "../../lib/types";
import { getRecommendedStore, getOtherStores } from "../../lib/playlist/stores";
import { withBeatportAid } from "../../lib/affiliates/beatport";
import { getBuyQueueItemId } from "@/lib/state/useBuyQueue";

const BEATPORT_A_AID = process.env.NEXT_PUBLIC_BEATPORT_A_AID;

type Props = {
  currentResult: unknown | null;
  displayedTracks: PlaylistRow[];
  queuedTrackIds?: Set<string>;
  onAddToBuyQueue?: (
    track: PlaylistRow,
    buyLink: { name: string; url: string },
  ) => void;

  // page.tsx が渡してくる余計な props を許容（互換のため）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

function firstStoreUrl(stores?: StoreLinks): string {
  const s = stores ?? ({} as StoreLinks);
  return (s.beatport ?? "") || (s.bandcamp ?? "") || "";
}

function beatportSearchUrl(track: PlaylistRow): string {
  const isrc = (track as { isrc?: string }).isrc ?? "";
  const artist = track.artist ?? "";
  const title = track.title ?? "";

  // ISRC があれば最優先（最もブレが少ない）
  const q = (isrc || `${artist} ${title}` || title || artist).trim();
  if (!q) return "";

  try {
    const u = new URL("https:");
    u.hostname = "beatport.com";
    u.pathname = "/search";
    u.searchParams.set("q", q);
    // 可能なら tracks に寄せる（Beatport側で無視されても害なし）
    u.searchParams.set("type", "tracks");
    return withBeatportAid(u.toString(), BEATPORT_A_AID);
  } catch {
    return "";
  }
}

function bandcampSearchUrl(track: PlaylistRow): string {
  const artist = track.artist ?? "";
  const title = track.title ?? "";
  const q = (`${artist} ${title}`.trim() || title || artist).trim();
  if (!q) return "";

  try {
    const u = new URL("https:");
    u.hostname = "bandcamp.com";
    u.pathname = "/search";
    u.searchParams.set("q", q);
    // track検索に寄せる（Bandcamp側で無視されても害なし）
    u.searchParams.set("item_type", "t");
    return u.toString();
  } catch {
    return "";
  }
}

function youtubeTopicUrl(track: { title?: string; artist?: string }) {
  const q = [track.artist, track.title, "topic"].filter(Boolean).join(" ");
  if (!q) return "";
  const proto = ["ht", "tps", ":", "//"].join("");
  const host = ["music", "youtube", "com"].join(".");
  return `${proto}${host}/search?q=${encodeURIComponent(q)}`;
}

function getPrimaryBuyLink(
  track: PlaylistRow,
): { name: string; url: string } | null {
  const recommended = getRecommendedStore(track);
  const primaryUrl = recommended?.url || firstStoreUrl(track.stores);
  const fallback = beatportSearchUrl(track) || bandcampSearchUrl(track);
  const url = primaryUrl || fallback;
  if (!url) return null;
  return { name: recommended?.name ?? (primaryUrl ? "ストア" : "検索"), url };
}

function StoreLinksInline({ track }: { track: PlaylistRow }) {
  const recommended = getRecommendedStore(track);
  const others = getOtherStores(track.stores, recommended);
  const primary = getPrimaryBuyLink(track);
  const yt = youtubeTopicUrl(track);

  const mainLabel = primary?.name ?? "ストア";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <a
        href={primary?.url || "#"}
        target="_blank"
        rel="noreferrer"
        aria-disabled={!primary}
        onClick={(e) => {
          if (!primary) e.preventDefault();
        }}
        className={`inline-flex items-center rounded-md border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-1.5 text-[11px] font-medium text-emerald-100 ${
          primary
            ? "hover:border-emerald-300/50 hover:bg-emerald-500/25"
            : "opacity-50 cursor-not-allowed"
        }`}
        title={primary ? "Open store" : "No store link"}
      >
        {mainLabel}
      </a>

      <a
        href={yt || "#"}
        target="_blank"
        rel="noreferrer"
        aria-disabled={!yt}
        onClick={(e) => {
          if (!yt) e.preventDefault();
        }}
        className={`inline-flex items-center rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-white/55 ${
          yt
            ? "hover:bg-white/10 hover:text-white/80"
            : "opacity-50 cursor-not-allowed"
        }`}
        title={yt ? "Open YouTube Music Topic search" : "Missing title/artist"}
      >
        YouTube Topic
      </a>

      {others.map((s) => (
        <a
          key={s.name}
          href={s.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-white/55 hover:bg-white/10 hover:text-white/80"
        >
          {s.name}
        </a>
      ))}
    </div>
  );
}

export default function ResultsTable({
  currentResult,
  displayedTracks,
  queuedTrackIds,
  onAddToBuyQueue,
}: Props) {
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
            <TrackCard
              key={`${t?.isrc ?? ""}-${i}`}
              track={t}
              queuedTrackIds={queuedTrackIds}
              onAddToBuyQueue={onAddToBuyQueue}
            />
          ))
        )}
      </div>

      <div className="hidden md:block rounded-2xl border border-white/10 overflow-x-auto bg-white/[0.02]">
        <table className="min-w-[980px] w-full text-xs">
          <thead className="bg-white/[0.04] text-white/55">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Title</th>
              <th className="px-4 py-2.5 text-left font-medium">Artist</th>
              <th className="px-4 py-2.5 text-left font-medium">Album</th>
              <th className="px-4 py-2.5 text-left font-medium">ISRC</th>
              <th className="px-4 py-2.5 text-left font-medium">ストア</th>
              <th className="px-4 py-2.5 text-left font-medium">あとで買う</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.map((t, i) => {
              const primary = getPrimaryBuyLink(t);
              const canQueue = t.owned !== true && Boolean(primary);
              const isQueued =
                queuedTrackIds?.has(getBuyQueueItemId(t)) ?? false;

              return (
                <tr
                  key={`${t?.isrc ?? ""}-${i}`}
                  className="hover:bg-white/[0.04]"
                >
                  <td className="px-4 py-3 text-sm font-medium text-white">
                    {t?.title ?? ""}
                  </td>
                  <td className="px-4 py-3 text-sm text-white/85">
                    {t?.artist ?? ""}
                  </td>
                  <td className="px-4 py-3 text-white/45">{t?.album ?? ""}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-white/30">
                    {t?.isrc ?? ""}
                  </td>
                  <td className="px-4 py-3">
                    <StoreLinksInline track={t} />
                  </td>
                  <td className="px-4 py-3">
                    {t.owned === true ? (
                      <span className="text-[11px] text-white/40">Owned</span>
                    ) : (
                      <button
                        type="button"
                        disabled={!canQueue || isQueued}
                        onClick={() => {
                          if (primary) onAddToBuyQueue?.(t, primary);
                        }}
                        className="rounded-md border border-white/15 bg-white/10 px-2.5 py-1.5 text-[11px] font-medium text-white/85 hover:bg-white/15 disabled:opacity-40"
                      >
                        {isQueued ? "追加済み" : "あとで買うへ追加"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TrackCard({
  track,
  queuedTrackIds,
  onAddToBuyQueue,
}: {
  track: PlaylistRow;
  queuedTrackIds?: Set<string>;
  onAddToBuyQueue?: (
    track: PlaylistRow,
    buyLink: { name: string; url: string },
  ) => void;
}) {
  const primary = getPrimaryBuyLink(track);
  const isQueued = queuedTrackIds?.has(getBuyQueueItemId(track)) ?? false;
  const canQueue = track.owned !== true && Boolean(primary);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-semibold text-white truncate">
            {track?.title ?? ""}
          </div>
          <div className="text-sm text-white/80 truncate">
            {track?.artist ?? ""}
          </div>
          <div className="text-xs text-white/45 truncate">
            {track?.album ?? ""}
          </div>
        </div>
        <div className="shrink-0 font-mono text-[11px] text-white/30">
          {track?.isrc ?? ""}
        </div>
      </div>
      <div className="mt-3">
        <StoreLinksInline track={track} />
      </div>
      {track.owned !== true ? (
        <div className="mt-3">
          <button
            type="button"
            disabled={!canQueue || isQueued}
            onClick={() => {
              if (primary) onAddToBuyQueue?.(track, primary);
            }}
            className="rounded-md border border-white/15 bg-white/10 px-2.5 py-1.5 text-[11px] font-medium text-white/85 hover:bg-white/15 disabled:opacity-40"
          >
            {isQueued ? "追加済み" : "あとで買うへ追加"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
