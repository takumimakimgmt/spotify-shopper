"use client";

import { useI18n } from "@/lib/i18n/LanguageProvider";
import React, { useId, useState, useRef } from "react";
import type { PlaylistRow } from "../../lib/types";
import { purchaseLinks } from "@/lib/domain/purchaseLinks";
import RecordingComparison from "./RecordingComparison";
import {
  effectiveOwned,
  libraryMatchLabel,
  libraryMatchExplanation,
} from "@/lib/domain/libraryMatch";
import { getBuyQueueItemId } from "@/lib/state/useBuyQueue";

type ReviewAction = "owned" | "different_version" | null;
type ReviewHandler = (track: PlaylistRow, action: ReviewAction) => void;
type Props = {
  paginationKey?: string;
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
  const { t: tr } = useI18n();

  const stores = purchaseLinks(track);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {stores.map((s) => (
        <a
          key={s.name}
          href={s.url}
          target="_blank"
          rel="noreferrer"
          title={tr(
            s.product
              ? "Track page · same version not verified"
              : "Search only · availability not verified",
          )}
          className={
            s.name === "Beatport"
              ? "inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-md border border-emerald-400/35 bg-emerald-400/10 px-3 py-2 text-xs font-medium text-emerald-100 transition-colors hover:border-emerald-400/60 hover:bg-emerald-400/20 focus-visible:outline-2 focus-visible:outline-emerald-300"
              : "inline-flex min-h-9 items-center text-xs text-slate-400 underline decoration-white/20 underline-offset-4 hover:text-white"
          }
        >
          {tr(s.label)}
        </a>
      ))}
    </div>
  );
}

function TrackTitle({ track }: { track: PlaylistRow }) {
  const { t: tr } = useI18n();
  const href = listenUrl(track);
  const title = track?.title ?? "";

  if (!href) {
    return (
      <div className="truncate text-base font-medium text-white">{title}</div>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={tr("Listen to {title}", { title })}
      className="inline-block max-w-full truncate border-b border-white/25 pb-0.5 text-base font-medium text-white hover:border-white/60 hover:text-white focus-visible:rounded-sm focus-visible:border-white/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
    >
      {title}
    </a>
  );
}

export default function ResultsTable({
  paginationKey,
  currentResult,
  displayedTracks,
  queuedTrackIds,
  onAddToBuyQueue,
  emptyMessage,
  onResetFilters,
  onReviewDecision,
  reviewReady = true,
}: Props) {
  const { t: tr } = useI18n();

  const rows = Array.isArray(displayedTracks) ? displayedTracks : [];
  const viewKey = paginationKey ?? displayedTracks;
  const [pageSize, setPageSize] = useState(20);
  const [selection, setSelection] = useState<{ key: unknown; page: number }>({
    key: viewKey,
    page: 1,
  });
  // Commit the new view identity so clearing a search cannot revive an old page.
  if (selection.key !== viewKey) setSelection({ key: viewKey, page: 1 });
  const listRef = useRef<HTMLDivElement>(null);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page =
    selection.key === viewKey ? Math.min(selection.page, pageCount) : 1;
  const start = (page - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);
  const goToPage = (next: number) => {
    setSelection({
      key: viewKey,
      page: Math.max(1, Math.min(next, pageCount)),
    });
    listRef.current?.focus({ preventScroll: true });
    listRef.current?.scrollIntoView?.({ block: "start" });
  };
  const pageControls = (position: string) => (
    <nav
      aria-label={tr(position)}
      className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm text-slate-300"
    >
      <p role="status">
        {tr("{start}–{end} of {total} tracks", {
          start: start + 1,
          end: Math.min(start + pageSize, rows.length),
          total: rows.length,
        })}
      </p>
      <div className="flex items-center gap-2">
        {position === "Track pages" && (
          <label className="mr-2 flex items-center gap-2 text-xs text-slate-400">
            {tr("Per page")}
            <select
              aria-label={tr("Tracks per page")}
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setSelection({ key: viewKey, page: 1 });
              }}
              className="min-h-10 rounded-md border border-white/15 bg-[#080c10] px-2 text-sm text-slate-200"
            >
              {[20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}
        {pageCount > 1 && (
          <>
            <button
              type="button"
              disabled={page === 1}
              onClick={() => goToPage(page - 1)}
              className="min-h-10 rounded-md border border-white/15 px-3 hover:bg-white/5 disabled:opacity-30"
            >
              {tr("Previous")}
            </button>
            <span className="px-1 tabular-nums">
              {tr("{page} / {pages}", { page, pages: pageCount })}
            </span>
            <button
              type="button"
              disabled={page === pageCount}
              onClick={() => goToPage(page + 1)}
              className="min-h-10 rounded-md border border-white/15 px-3 hover:bg-white/5 disabled:opacity-30"
            >
              {tr("Next")}
            </button>
          </>
        )}
      </div>
    </nav>
  );
  if (!currentResult) return null;
  if (rows.length === 0)
    return (
      <div
        role="status"
        className="rounded-lg border border-white/15 bg-white/5 p-5 text-sm text-slate-300"
      >
        <p>{tr(emptyMessage ?? "No tracks to display.")}</p>
        {onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="mt-3 rounded border border-white/20 px-3 py-2"
          >
            {tr("Show all tracks")}
          </button>
        )}
      </div>
    );

  return (
    <div
      ref={listRef}
      tabIndex={-1}
      className="scroll-mt-44 space-y-3 outline-none"
    >
      {pageControls("Track pages")}
      <details className="text-xs leading-5 text-slate-400">
        <summary className="cursor-pointer hover:text-slate-200">
          {tr("About store links")}
        </summary>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          {tr(
            "“Search Beatport” opens search results in a new tab. “Beatport track page” opens a product page. Check the version and availability before buying.",
          )}
        </p>
      </details>
      <div className="md:hidden space-y-2">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-white/15 bg-white/5 p-4 text-sm text-slate-300 text-center">
            {tr("No tracks")}
          </div>
        ) : (
          pageRows.map((t, i) => (
            <TrackCard
              key={`${getBuyQueueItemId(t)}-${i}`}
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
            <col className="w-[45%]" />
            <col className="w-[15%]" />
            <col className="w-[26%]" />
            <col className="w-[14%]" />
          </colgroup>
          <thead className="border-b border-white/15 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500">
            <tr>
              {["Track", "Status", "Store", "Save"].map((label) => (
                <th key={label} scope="col" className="px-3 py-3">
                  {tr(label)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((track, i) => (
              <DesktopTrackRow
                key={`${getBuyQueueItemId(track)}-${i}`}
                track={track}
                queuedTrackIds={queuedTrackIds}
                onAddToBuyQueue={onAddToBuyQueue}
                onReviewDecision={onReviewDecision}
                reviewReady={reviewReady}
              />
            ))}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && pageControls("Track pages bottom")}
    </div>
  );
}

function DesktopTrackRow({
  track,
  queuedTrackIds,
  onAddToBuyQueue,
  onReviewDecision,
  reviewReady,
}: {
  track: PlaylistRow;
} & Pick<
  Props,
  "queuedTrackIds" | "onAddToBuyQueue" | "onReviewDecision" | "reviewReady"
>) {
  const { t: tr } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const primary = getPrimaryBuyLink(track);
  const owned = effectiveOwned(track);
  const isQueued = queuedTrackIds?.has(getBuyQueueItemId(track)) ?? false;
  return (
    <>
      <tr className="group border-b border-white/10 transition-colors hover:bg-white/[0.025]">
        <td className="px-3 py-3 align-middle">
          <div className="min-w-0">
            <TrackTitle track={track} />
          </div>
          <div
            className="mt-1 truncate text-sm text-slate-300"
            title={track.artist}
          >
            {track.artist}
          </div>
          {track.album &&
            track.album.trim().toLowerCase() !==
              track.title.trim().toLowerCase() && (
              <div
                className="mt-0.5 truncate text-xs text-slate-500"
                title={track.album}
              >
                {track.album}
              </div>
            )}
        </td>
        <td className="px-3 py-3 align-middle">
          <span
            title={tr(libraryMatchExplanation(track))}
            className={`inline-block rounded-full border px-2 py-1 text-[11px] leading-snug ${owned === true ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-200" : owned === false ? "border-white/10 bg-white/5 text-slate-300" : "border-amber-400/20 bg-amber-400/5 text-amber-200"}`}
          >
            {tr(libraryMatchLabel(track))}
          </span>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={detailsId}
            onClick={() => setExpanded(!expanded)}
            className="mt-1 inline-flex min-h-7 items-center gap-1.5 text-xs text-slate-400 hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300"
          >
            <span aria-hidden="true">{expanded ? "−" : "+"}</span>
            {tr("Matching details")}
          </button>
        </td>
        <td className="px-3 py-3 align-middle">
          {owned === true ? null : primary ? (
            <StoreLinksInline track={track} />
          ) : (
            <span className="text-xs text-slate-400">{tr("Not found")}</span>
          )}
        </td>
        <td className="px-3 py-3 align-middle">
          {owned === true ? null : owned === false && primary ? (
            <button
              type="button"
              disabled={isQueued}
              onClick={() => onAddToBuyQueue?.(track, primary)}
              className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-md border border-white/15 px-3 py-2 text-xs text-slate-200 transition-colors hover:bg-white/5 disabled:border-emerald-300/20 disabled:bg-emerald-300/5 disabled:text-emerald-200"
            >
              {isQueued ? `✓ ${tr("Saved")}` : tr("Buy Later")}
            </button>
          ) : (
            <span
              className="text-xs text-slate-500"
              title={tr(libraryMatchExplanation(track))}
            >
              {tr(owned == null ? "Review needed" : "Unavailable")}
            </span>
          )}
        </td>
      </tr>
      <tr hidden={!expanded} id={detailsId}>
        <td
          colSpan={4}
          className="border-b border-white/10 bg-white/[0.025] px-5 py-5 text-xs text-slate-300"
        >
          {track.changeStatus && track.changeStatus !== "unchanged" && (
            <p className="mb-3 text-slate-400">
              {tr("Change status")}: {tr(track.changeStatus)}
            </p>
          )}
          <MatchEvidence
            track={track}
            onReviewDecision={onReviewDecision}
            reviewReady={reviewReady}
          />
        </td>
      </tr>
    </>
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
  const { t: tr } = useI18n();

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
            {tr(libraryMatchLabel(track))}
          </div>
        ) : (
          <div className="shrink-0 text-xs text-slate-300">
            {tr(libraryMatchLabel(track))}
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
        <div className="mt-3 text-sm text-slate-400">
          {tr("No store found")}
        </div>
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
            {isQueued ? tr("Saved") : tr("Buy Later")}
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
  const { t: tr } = useI18n();

  return (
    <details className="mt-2 text-xs text-slate-300">
      <summary className="cursor-pointer">
        {tr("Matching details")}
        {track.changeStatus && track.changeStatus !== "unchanged"
          ? ` · ${tr(track.changeStatus)}`
          : ""}
      </summary>
      <MatchEvidence
        track={track}
        onReviewDecision={onReviewDecision}
        reviewReady={reviewReady}
      />
    </details>
  );
}

function MatchEvidence({
  track,
  onReviewDecision,
  reviewReady,
}: {
  track: PlaylistRow;
  onReviewDecision?: ReviewHandler;
  reviewReady?: boolean;
}) {
  const { t: tr } = useI18n();
  const candidate = track.libraryMatch;
  return (
    <div className="space-y-3">
      <p className="mt-1">{tr(libraryMatchExplanation(track))}</p>
      {track.reviewDecision && (
        <p>
          {tr("Automatic XML result:")}{" "}
          {tr(libraryMatchLabel({ ...track, reviewDecision: undefined }))}
        </p>
      )}
      {onReviewDecision && (
        <div className="mt-2 flex flex-wrap gap-3">
          <button
            disabled={!reviewReady}
            type="button"
            onClick={() => onReviewDecision(track, "owned")}
          >
            {tr("I own this recording")}
          </button>
          {candidate?.matched_title && (
            <button
              disabled={!reviewReady}
              type="button"
              onClick={() => onReviewDecision(track, "different_version")}
            >
              {tr("This candidate is a different version")}
            </button>
          )}
          {track.reviewDecision && (
            <button
              disabled={!reviewReady}
              type="button"
              onClick={() => onReviewDecision(track, null)}
            >
              {tr("Forget my confirmation")}
            </button>
          )}
        </div>
      )}
      <RecordingComparison track={track} />
    </div>
  );
}
