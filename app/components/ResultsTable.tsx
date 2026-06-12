"use client";

import React from "react";
import type { PlaylistRow, StoreLinks } from "../../lib/types";
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

function purchaseLinks(
  track: PlaylistRow,
): Array<{ name: string; url: string }> {
  const stores = track.stores ?? ({} as StoreLinks);
  const links: Array<{ name: string; url: string }> = [];
  const beatport =
    withBeatportAid(stores.beatport ?? "", BEATPORT_A_AID) ||
    beatportSearchUrl(track);
  if (beatport) links.push({ name: "Beatport", url: beatport });

  const bandcamp = stores.bandcamp || bandcampSearchUrl(track);
  if (bandcamp) links.push({ name: "Bandcamp", url: bandcamp });

  return links;
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

function listenUrl(track: PlaylistRow): string {
  return track.spotifyUrl || youtubeTopicUrl(track);
}

function getPrimaryBuyLink(
  track: PlaylistRow,
): { name: string; url: string } | null {
  return purchaseLinks(track)[0] ?? null;
}

function StoreLinksInline({ track }: { track: PlaylistRow }) {
  const stores = purchaseLinks(track);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {stores.map((s) => (
        <a
          key={s.name}
          href={s.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-white/10 bg-white/10 px-2 py-1 text-[11px] text-white hover:bg-white/15"
        >
          {s.name}
        </a>
      ))}
    </div>
  );
}

function TrackTitle({ track }: { track: PlaylistRow }) {
  const href = listenUrl(track);
  const title = track?.title ?? "";

  if (!href) {
    return (
      <div className="truncate text-sm font-medium text-white">{title}</div>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`Listen to ${title}`}
      className="inline-block max-w-full truncate border-b border-white/25 pb-0.5 text-sm font-medium text-white hover:border-white/60 hover:text-white focus-visible:rounded-sm focus-visible:border-white/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
    >
      {title}
    </a>
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
    <div className="space-y-2">
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

      <div className="hidden md:block">
        <table className="w-full table-fixed text-xs">
          <colgroup>
            <col className="w-[34%]" />
            <col className="w-[25%]" />
            <col className="w-[9%]" />
            <col className="w-[20%]" />
            <col className="w-[12%]" />
          </colgroup>
          <thead className="sr-only">
            <tr>
              <th scope="col">Title</th>
              <th scope="col">Artist and album</th>
              <th scope="col">Owned</th>
              <th scope="col">Store</th>
              <th scope="col">Buy Later</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.map((t, i) => {
              const primary = getPrimaryBuyLink(t);
              const isOwned = t.owned === true;
              const canQueue = !isOwned && Boolean(primary);
              const isQueued =
                queuedTrackIds?.has(getBuyQueueItemId(t)) ?? false;

              return (
                <tr key={`${t?.isrc ?? ""}-${i}`} className="hover:bg-white/5">
                  <td className="px-3 py-3 align-middle">
                    <div className="min-w-0">
                      <TrackTitle track={t} />
                    </div>
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <div className="min-w-0">
                      <div className="truncate text-white/70">
                        {t?.artist ?? ""}
                      </div>
                      {t?.album ? (
                        <div className="truncate text-white/40">{t.album}</div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-3 align-middle text-white/60">
                    {isOwned ? (
                      <span className="truncate text-[11px] text-white/40">
                        Owned
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 align-middle">
                    {isOwned ? null : <StoreLinksInline track={t} />}
                  </td>
                  <td className="px-3 py-3 align-middle">
                    {isOwned ? null : (
                      <button
                        type="button"
                        disabled={!canQueue || isQueued}
                        onClick={() => {
                          if (primary) onAddToBuyQueue?.(t, primary);
                        }}
                        className="whitespace-nowrap rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/80 hover:bg-white/10 disabled:opacity-40"
                      >
                        {isQueued ? "Saved" : "Buy Later"}
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
  const isOwned = track.owned === true;
  const isQueued = queuedTrackIds?.has(getBuyQueueItemId(track)) ?? false;
  const canQueue = !isOwned && Boolean(primary);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">
            <TrackTitle track={track} />
          </div>
          <div className="text-xs text-white/70 truncate">
            {track?.artist ?? ""}
          </div>
          <div className="text-xs text-white/50 truncate">
            {track?.album ?? ""}
          </div>
        </div>
        <div className="shrink-0 text-[11px] text-white/40">
          {isOwned ? "Owned" : (track?.isrc ?? "")}
        </div>
      </div>
      {isOwned ? null : (
        <div className="mt-2">
          <StoreLinksInline track={track} />
        </div>
      )}
      {!isOwned ? (
        <div className="mt-2">
          <button
            type="button"
            disabled={!canQueue || isQueued}
            onClick={() => {
              if (primary) onAddToBuyQueue?.(track, primary);
            }}
            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/80 hover:bg-white/10 disabled:opacity-40"
          >
            {isQueued ? "Saved" : "Buy Later"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
