"use client";

import React from "react";
import type { PlaylistRow, StoreLinks } from "../../lib/types";
import { withBeatportAid } from "../../lib/affiliates/beatport";
import {
  effectiveOwned,
  libraryMatchLabel,
  libraryMatchExplanation,
} from "@/lib/domain/libraryMatch";
import { getBuyQueueItemId } from "@/lib/state/useBuyQueue";

const BEATPORT_A_AID = process.env.NEXT_PUBLIC_BEATPORT_A_AID;

type ReviewAction = "owned" | "different_version" | null;
type ReviewHandler = (track: PlaylistRow, action: ReviewAction) => void;
type Props = {
  onReviewDecision?: ReviewHandler;
  reviewReady?: boolean;
  currentResult: unknown | null;
  emptyMessage?: string;
  onResetFilters?: () => void;
  displayedTracks: PlaylistRow[];
  queuedTrackIds?: Set<string>;
  onAddToBuyQueue?: (
    track: PlaylistRow,
    buyLink: { name: string; url: string },
  ) => void;
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
    const u = new URL("https://beatport.com");
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
    const u = new URL("https://bandcamp.com");
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
          className="inline-flex min-h-9 items-center gap-1 whitespace-nowrap rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/15"
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
  emptyMessage,
  onResetFilters,
  onReviewDecision,
  reviewReady = true,
}: Props) {
  if (!currentResult) return null;
  const rows = Array.isArray(displayedTracks) ? displayedTracks : [];
  if (rows.length === 0)
    return (
      <div
        role="status"
        className="rounded-lg border border-white/15 bg-white/5 p-5 text-sm text-slate-300"
      >
        <p>{emptyMessage ?? "No tracks to display."}</p>
        {onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="mt-3 rounded border border-white/20 px-3 py-2"
          >
            Show all tracks
          </button>
        )}
      </div>
    );

  return (
    <div className="space-y-2">
      <div className="md:hidden space-y-2">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-white/15 bg-white/5 p-4 text-sm text-slate-300 text-center">
            No tracks
          </div>
        ) : (
          rows.map((t, i) => (
            <TrackCard
              key={`${t?.isrc ?? ""}-${i}`}
              track={t}
              queuedTrackIds={queuedTrackIds}
              onAddToBuyQueue={onAddToBuyQueue}
              onReviewDecision={onReviewDecision}
              reviewReady={reviewReady}
            />
          ))
        )}
      </div>

      <div className="hidden md:block">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-[34%]" />
            <col className="w-[25%]" />
            <col className="w-[9%]" />
            <col className="w-[20%]" />
            <col className="w-[12%]" />
          </colgroup>
          <thead className="border-b border-white/15 text-left text-xs font-semibold uppercase text-slate-400">
            <tr>
              <th scope="col" className="px-3 py-2">
                Track
              </th>
              <th scope="col" className="px-3 py-2">
                Artist / album
              </th>
              <th scope="col" className="px-3 py-2">
                Status
              </th>
              <th scope="col" className="px-3 py-2">
                Store
              </th>
              <th scope="col" className="px-3 py-2">
                Save
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.map((t, i) => {
              const primary = getPrimaryBuyLink(t);
              const isOwned = effectiveOwned(t) === true;
              const canQueue = effectiveOwned(t) === false && Boolean(primary);
              const isQueued =
                queuedTrackIds?.has(getBuyQueueItemId(t)) ?? false;

              return (
                <tr key={`${t?.isrc ?? ""}-${i}`} className="hover:bg-white/5">
                  <td className="px-3 py-3 align-middle">
                    <div className="min-w-0">
                      <TrackTitle track={t} />
                      <MatchDetails
                        track={t}
                        onReviewDecision={onReviewDecision}
                        reviewReady={reviewReady}
                      />
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
                      <span className="truncate rounded bg-emerald-400/10 px-2 py-1 text-xs text-emerald-200">
                        {libraryMatchLabel(t)}
                      </span>
                    ) : (
                      <span
                        title={
                          t.owned == null
                            ? libraryMatchExplanation(t)
                            : undefined
                        }
                        className="text-xs text-slate-300"
                      >
                        {libraryMatchLabel(t)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 align-middle">
                    {isOwned ? null : primary ? (
                      <StoreLinksInline track={t} />
                    ) : (
                      <span className="text-sm text-slate-400">Not found</span>
                    )}
                  </td>
                  <td className="px-3 py-3 align-middle">
                    {isOwned ? null : canQueue ? (
                      <button
                        type="button"
                        disabled={isQueued}
                        onClick={() => {
                          if (primary) onAddToBuyQueue?.(t, primary);
                        }}
                        className="min-h-9 whitespace-nowrap rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-slate-100 hover:bg-white/10 disabled:text-slate-400"
                      >
                        {isQueued ? "Saved" : "Buy Later"}
                      </button>
                    ) : (
                      <span className="text-sm text-slate-400">
                        {t.owned == null ? (
                          <span title={libraryMatchExplanation(t)}>
                            Review needed
                          </span>
                        ) : (
                          "Unavailable"
                        )}
                      </span>
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
  onReviewDecision,
  reviewReady,
}: {
  onReviewDecision?: ReviewHandler;
  reviewReady?: boolean;
  track: PlaylistRow;
  queuedTrackIds?: Set<string>;
  onAddToBuyQueue?: (
    track: PlaylistRow,
    buyLink: { name: string; url: string },
  ) => void;
}) {
  const primary = getPrimaryBuyLink(track);
  const isOwned = effectiveOwned(track) === true;
  const isQueued = queuedTrackIds?.has(getBuyQueueItemId(track)) ?? false;
  const canQueue = effectiveOwned(track) === false && Boolean(primary);

  return (
    <div className="rounded-lg border border-white/15 bg-white/5 p-4">
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
        {isOwned ? (
          <div className="shrink-0 rounded bg-emerald-400/10 px-2 py-1 text-xs text-emerald-200">
            {libraryMatchLabel(track)}
          </div>
        ) : (
          <div className="shrink-0 text-xs text-slate-300">
            {libraryMatchLabel(track)}
          </div>
        )}
      </div>
      <MatchDetails
        track={track}
        onReviewDecision={onReviewDecision}
        reviewReady={reviewReady}
      />
      {isOwned ? null : primary ? (
        <div className="mt-2">
          <StoreLinksInline track={track} />
        </div>
      ) : (
        <div className="mt-3 text-sm text-slate-400">No store found</div>
      )}
      {!isOwned && canQueue ? (
        <div className="mt-2">
          <button
            type="button"
            disabled={isQueued}
            onClick={() => {
              if (primary) onAddToBuyQueue?.(track, primary);
            }}
            className="min-h-9 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-slate-100 hover:bg-white/10 disabled:text-slate-400"
          >
            {isQueued ? "Saved" : "Buy Later"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MatchDetails({
  track,
  onReviewDecision,
  reviewReady,
}: {
  track: PlaylistRow;
  onReviewDecision?: ReviewHandler;
  reviewReady?: boolean;
}) {
  const candidate = track.libraryMatch;
  return (
    <details className="mt-2 text-xs text-slate-300">
      <summary className="cursor-pointer">
        Matching details
        {track.changeStatus && track.changeStatus !== "unchanged"
          ? ` · ${track.changeStatus}`
          : ""}
      </summary>
      <p className="mt-1">{libraryMatchExplanation(track)}</p>
      {track.reviewDecision && (
        <p>
          Automatic XML result:{" "}
          {libraryMatchLabel({ ...track, reviewDecision: undefined })}
        </p>
      )}
      {onReviewDecision && (
        <div className="mt-2 flex flex-wrap gap-3">
          <button
            disabled={!reviewReady}
            type="button"
            onClick={() => onReviewDecision(track, "owned")}
          >
            I own this recording
          </button>
          {candidate?.matched_title && (
            <button
              disabled={!reviewReady}
              type="button"
              onClick={() => onReviewDecision(track, "different_version")}
            >
              This candidate is a different version
            </button>
          )}
          {track.reviewDecision && (
            <button
              disabled={!reviewReady}
              type="button"
              onClick={() => onReviewDecision(track, null)}
            >
              Forget my confirmation
            </button>
          )}
        </div>
      )}
      {candidate?.matched_title && (
        <p className="mt-1 break-words">
          XML candidate: {candidate.matched_title} —{" "}
          {candidate.matched_artist || "Artist not supplied"}
        </p>
      )}
    </details>
  );
}
