"use client";

import { useI18n } from "@/lib/i18n/LanguageProvider";
import React, { useId, useState, useRef } from "react";
import type { PlaylistRow } from "../../lib/types";
import { purchaseLinks } from "@/lib/domain/purchaseLinks";
import { TrackIdentity, TrackStoreLinks } from "./TrackPresentation";
import RecordingComparison from "./RecordingComparison";
import {
  effectiveOwned,
  libraryMatchLabel,
  libraryCheckState,
  libraryMatchExplanation,
} from "@/lib/domain/libraryMatch";
import { getBuyQueueItemId } from "@/lib/state/useBuyQueue";

type ReviewAction = "owned" | "different_version" | null;
type ReviewHandler = (track: PlaylistRow, action: ReviewAction) => void;
type Props = {
  saveBatchSummary?: { duplicates: number; saved: number; excluded: number };
  compactStatus?: boolean;
  onSaveBatch?: () => void;
  saveBatchCount?: number;
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

function getPrimaryBuyLink(
  track: PlaylistRow,
): { name: string; url: string } | null {
  return purchaseLinks(track)[0] ?? null;
}

function StoreLinksInline({ track }: { track: PlaylistRow }) {
  return <TrackStoreLinks track={track} />;
}

export default function ResultsTable({
  compactStatus = false,
  saveBatchSummary,
  onSaveBatch,
  saveBatchCount = 0,
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
  const allEligibleSaved =
    saveBatchCount === 0 &&
    rows.some((track) => effectiveOwned(track) === false);
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
      className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm text-secondary"
    >
      <div className="flex flex-wrap items-center gap-3">
        {" "}
        <p role="status">
          {tr("{start}–{end} of {total} tracks", {
            start: start + 1,
            end: Math.min(start + pageSize, rows.length),
            total: rows.length,
          })}
        </p>
        {position === "Track pages" && onSaveBatch && (
          <button
            type="button"
            onClick={onSaveBatch}
            disabled={saveBatchCount === 0}
            title={tr(
              "Adds matching unsaved tracks from every page. Tracks needing review are excluded.",
            )}
            className="ps-action-primary"
          >
            {saveBatchCount
              ? tr(
                  saveBatchCount === 1
                    ? "Add {count} track to Buy Later"
                    : "Add {count} tracks to Buy Later",
                  { count: saveBatchCount },
                )
              : tr(allEligibleSaved ? "All saved" : "Save filtered tracks")}
          </button>
        )}
        {position === "Track pages" && onSaveBatch && (
          <p className="text-xs text-muted">
            {tr(
              saveBatchCount
                ? "Across all filtered pages"
                : allEligibleSaved
                  ? "All eligible tracks in this filter are already saved."
                  : "No unsaved eligible tracks. Check XML matching or change filters.",
            )}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {position === "Track pages" && (
          <label className="mr-2 flex items-center gap-2 text-xs text-muted">
            {tr("Per page")}
            <select
              aria-label={tr("Tracks per page")}
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setSelection({ key: viewKey, page: 1 });
              }}
              className="min-h-10 rounded-md border border-white/15 bg-surface px-2 text-sm text-slate-200"
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
        className="rounded-lg border border-white/15 bg-white/5 p-5 text-sm text-secondary"
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
      {onSaveBatch && saveBatchSummary && (
        <p className="text-sm text-muted">
          {tr(
            "{duplicates} duplicate rows · {saved} already saved · {excluded} not eligible",
            saveBatchSummary,
          )}
        </p>
      )}
      <details className="text-xs leading-5 text-muted">
        <summary className="cursor-pointer hover:text-slate-200">
          {tr("About store links")}
        </summary>
        <p className="mt-2 text-sm leading-6 text-secondary">
          {tr(
            "“Search Beatport” opens search results in a new tab. “Beatport track page” opens a product page. Check the version and availability before buying.",
          )}
        </p>
      </details>
      <div className="md:hidden space-y-2">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-white/15 bg-white/5 p-4 text-sm text-secondary text-center">
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
              compactStatus={compactStatus}
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
          <thead className="border-b border-white/15 text-left text-[11px] font-medium uppercase tracking-wider text-muted">
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
                compactStatus={compactStatus}
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
  compactStatus,
  track,
  queuedTrackIds,
  onAddToBuyQueue,
  onReviewDecision,
  reviewReady,
}: {
  track: PlaylistRow;
  compactStatus?: boolean;
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
          <TrackIdentity track={track} />
        </td>
        <td className="px-3 py-3 align-middle">
          {!compactStatus && <LibraryStatus track={track} />}
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={detailsId}
            onClick={() => setExpanded(!expanded)}
            className="mt-1 inline-flex min-h-7 items-center gap-1.5 text-xs text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-emerald-300"
          >
            <span aria-hidden="true">{expanded ? "−" : "+"}</span>
            {tr(compactStatus ? "Details" : "Matching details")}
          </button>
        </td>
        <td className="px-3 py-3 align-middle">
          {owned === true ? null : primary ? (
            <StoreLinksInline track={track} />
          ) : (
            <span className="text-xs text-muted">{tr("Not found")}</span>
          )}
        </td>
        <td className="px-3 py-3 align-middle">
          {owned === true ? null : owned === false && primary ? (
            <button
              type="button"
              disabled={isQueued}
              onClick={() => onAddToBuyQueue?.(track, primary)}
              className="ps-action-secondary whitespace-nowrap"
            >
              {isQueued ? `✓ ${tr("Saved")}` : tr("Buy Later")}
            </button>
          ) : (
            <span
              className="text-xs text-muted"
              title={tr(libraryMatchExplanation(track))}
            >
              {tr(
                owned == null
                  ? libraryCheckState(track) === "unchecked"
                    ? "Add XML to save"
                    : "Review needed"
                  : "Unavailable",
              )}
            </span>
          )}
        </td>
      </tr>
      <tr hidden={!expanded} id={detailsId}>
        <td
          colSpan={4}
          className="border-b border-white/10 bg-white/[0.025] px-5 py-5 text-xs text-secondary"
        >
          {track.changeStatus && track.changeStatus !== "unchanged" && (
            <p className="mb-3 text-muted">
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
  compactStatus,
  track,
  queuedTrackIds,
  onAddToBuyQueue,
  onReviewDecision,
  reviewReady,
}: {
  compactStatus?: boolean;
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
    <div className="border-b border-white/15 py-4">
      <div className="flex flex-col gap-2">
        <TrackIdentity track={track} />
        {!compactStatus && <LibraryStatus track={track} />}
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
        <div className="mt-3 text-sm text-muted">{tr("No store found")}</div>
      )}
      {!isOwned && canQueue ? (
        <div className="mt-2">
          <button
            type="button"
            disabled={isQueued}
            onClick={() => {
              if (primary) onAddToBuyQueue?.(track, primary);
            }}
            className="ps-action-secondary"
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
    <details className="mt-2 text-xs text-secondary">
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

function LibraryStatus({ track }: { track: PlaylistRow }) {
  const { t } = useI18n();
  const state = libraryCheckState(track);
  return (
    <span
      title={t(libraryMatchExplanation(track))}
      className={`inline-flex w-fit rounded border px-2 py-1 text-xs leading-5 ${state === "review" ? "border-review/35 bg-review/5 text-review" : state === "matched" ? "border-accent/30 text-accent" : "border-white/20 text-secondary"}`}
    >
      {t(libraryMatchLabel(track))}
    </span>
  );
}
