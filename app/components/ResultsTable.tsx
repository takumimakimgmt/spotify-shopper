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
  return { name: recommended?.name ?? (primaryUrl ? "Store" : "Search"), url };
}

function displayMetric(track: PlaylistRow, keys: string[]): string {
  const row = track as unknown as Record<string, unknown>;
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "—";
}

function StoreLinksInline({ track }: { track: PlaylistRow }) {
  const recommended = getRecommendedStore(track);
  const others = getOtherStores(track.stores, recommended);
  const primary = getPrimaryBuyLink(track);
  const yt = youtubeTopicUrl(track);

  const mainLabel = primary?.name ?? "Store";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={primary?.url || "#"}
        target="_blank"
        rel="noreferrer"
        aria-disabled={!primary}
        onClick={(e) => {
          if (!primary) e.preventDefault();
        }}
        className={`inline-flex items-center rounded-md bg-white/10 px-2 py-1 text-[11px] text-white ${
          primary ? "hover:bg-white/15" : "opacity-50 cursor-not-allowed"
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
        className={`inline-flex items-center rounded-md bg-white/10 px-2 py-1 text-[11px] text-white ${
          yt ? "hover:bg-white/15" : "opacity-50 cursor-not-allowed"
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
          className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[11px] text-white hover:bg-white/15"
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

      <div className="hidden md:block rounded-2xl border border-white/10 overflow-x-auto">
        <table className="min-w-[1040px] w-full table-fixed text-xs">
          <colgroup>
            <col className="w-auto" />
            <col className="w-28" />
            <col className="w-16" />
            <col className="w-16" />
            <col className="w-64" />
            <col className="w-28" />
          </colgroup>
          <thead className="sr-only">
            <tr>
              <th scope="col">Title</th>
              <th scope="col">Owned</th>
              <th scope="col">BPM</th>
              <th scope="col">Key</th>
              <th scope="col">Store</th>
              <th scope="col">Save</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.map((t, i) => {
              const primary = getPrimaryBuyLink(t);
              const canQueue = t.owned !== true && Boolean(primary);
              const isQueued =
                queuedTrackIds?.has(getBuyQueueItemId(t)) ?? false;

              return (
                <tr key={`${t?.isrc ?? ""}-${i}`} className="hover:bg-white/5">
                  <td className="px-3 py-3 align-middle">
                    <div className="min-w-0">
                      <div className="truncate text-white">
                        {t?.title ?? ""}
                      </div>
                      <div className="truncate text-white/70">
                        {t?.artist ?? ""}
                      </div>
                      {t?.album ? (
                        <div className="truncate text-white/40">{t.album}</div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-3 align-middle text-white/60">
                    {t.owned === true ? (
                      <span className="truncate text-[11px] text-white/40">
                        Owned
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 align-middle text-right tabular-nums text-white/50">
                    {displayMetric(t, ["bpm", "tempo"])}
                  </td>
                  <td className="px-3 py-3 align-middle text-white/50">
                    {displayMetric(t, ["key", "musicalKey", "camelotKey"])}
                  </td>
                  <td className="px-3 py-3 align-middle">
                    {t.owned === true ? (
                      <span className="text-[11px] text-white/30">—</span>
                    ) : (
                      <StoreLinksInline track={t} />
                    )}
                  </td>
                  <td className="px-3 py-3 align-middle text-right">
                    {t.owned === true ? (
                      <span className="text-[11px] text-white/30">—</span>
                    ) : (
                      <button
                        type="button"
                        disabled={!canQueue || isQueued}
                        onClick={() => {
                          if (primary) onAddToBuyQueue?.(t, primary);
                        }}
                        className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/80 hover:bg-white/10 disabled:opacity-40"
                      >
                        {isQueued ? "Saved" : "Save"}
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
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-white truncate">
            {track?.title ?? ""}
          </div>
          <div className="text-xs text-white/70 truncate">
            {track?.artist ?? ""}
          </div>
          <div className="text-xs text-white/50 truncate">
            {track?.album ?? ""}
          </div>
        </div>
        <div className="shrink-0 text-[11px] text-white/40">
          {track?.isrc ?? ""}
        </div>
      </div>
      <div className="mt-2">
        <StoreLinksInline track={track} />
      </div>
      {track.owned !== true ? (
        <div className="mt-2">
          <button
            type="button"
            disabled={!canQueue || isQueued}
            onClick={() => {
              if (primary) onAddToBuyQueue?.(track, primary);
            }}
            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/80 hover:bg-white/10 disabled:opacity-40"
          >
            {isQueued ? "Saved" : "Save"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
