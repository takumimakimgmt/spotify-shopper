"use client";

import { useId, useState } from "react";
import {
  libraryMatchLabel,
  libraryMatchExplanation,
} from "@/lib/domain/libraryMatch";
import { LOCAL_RULES_VERSION } from "@/lib/rekordbox/localMatcher";
import type { QueueEvidence } from "@/lib/domain/buyQueueEvidence";
import type { PlaylistRow } from "@/lib/types";
import RecordingComparison from "./RecordingComparison";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import {
  TrackIdentity,
  TrackSourceLink,
  TrackStoreLinks,
} from "./TrackPresentation";

type QuietBuyLaterItem = {
  id: string;
  title: string;
  artist: string;
  album?: string;
  isrc?: string;
  spotifyUrl?: string;
  buyUrl: string;
  buyStore: string;
  evidence?: QueueEvidence;
  currentEvidence?: QueueEvidence;
};

export default function BuyLaterPanel({
  items,
  onRemove,
  onClear,
  onUndoRemove,
  removedCount = 0,
  storageWarning,
  onRetrySave,
  showHeading = true,
}: {
  items: QuietBuyLaterItem[];
  onRemove: (id: string) => void;
  onClear?: () => void;
  onUndoRemove?: () => void;
  removedCount?: number;
  storageWarning?: string | null;
  onRetrySave?: () => void;
  showHeading?: boolean;
}) {
  const { t: tr } = useI18n();
  if (items.length === 0 && !storageWarning && !removedCount) return null;
  return (
    <section className="text-sm text-secondary">
      {showHeading && (
        <h2 className="text-lg font-semibold text-foreground">
          {tr("Buy Later")}
        </h2>
      )}
      {storageWarning && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-amber-300/25 p-3 text-amber-200"
        >
          <p>{tr(storageWarning)}</p>
          <button
            type="button"
            onClick={onRetrySave}
            className="mt-2 min-h-10 rounded border border-white/20 px-3"
          >
            {tr("Retry storage")}
          </button>
        </div>
      )}
      {removedCount > 0 && (
        <div
          role="status"
          className="mb-4 flex flex-wrap items-center gap-3 rounded border border-white/15 p-3"
        >
          <span>
            {tr(
              removedCount === 1
                ? "Removed {count} track"
                : "Removed {count} tracks",
              { count: removedCount },
            )}
          </span>
          <button
            type="button"
            onClick={onUndoRemove}
            className="ps-action-secondary"
          >
            {tr("Undo")}
          </button>
        </div>
      )}
      {items.length > 0 && (
        <>
          <p className="mb-2 text-xs leading-5 text-muted">
            {tr(
              "Most recent additions first. Tracks added together keep their playlist order.",
            )}
          </p>
          <p className="mb-4 text-sm leading-6 text-secondary">
            {tr(
              "Beatport links are affiliate links. Availability and the exact version are not verified.",
            )}
          </p>
          <ul className="divide-y divide-white/10">
            {items.map((item) => (
              <SavedTrackRow key={item.id} item={item} onRemove={onRemove} />
            ))}
          </ul>
          <details className="mt-5 border-t border-white/10 pt-4 text-xs text-muted">
            <summary className="cursor-pointer">
              {tr("Manage saved tracks")}
            </summary>
            <button
              type="button"
              onClick={() =>
                onClear ? onClear() : items.forEach((item) => onRemove(item.id))
              }
              className="mt-2 min-h-10 text-secondary hover:text-foreground"
            >
              {tr("Clear")}
            </button>
          </details>
        </>
      )}
    </section>
  );
}

function SavedTrackRow({
  item,
  onRemove,
}: {
  item: QuietBuyLaterItem;
  onRemove: (id: string) => void;
}) {
  const { t, language } = useI18n();
  const [open, setOpen] = useState(false);
  const id = useId();
  const current = item.currentEvidence;
  const evidence =
    current &&
    (!item.evidence ||
      Date.parse(current.checkedAt || "") >=
        Date.parse(item.evidence.checkedAt || ""))
      ? current
      : item.evidence;
  const stale = !!evidence && evidence.rulesVersion !== LOCAL_RULES_VERSION;
  const row = {
    ...item,
    index: 0,
    album: item.album || "",
    stores: {},
    owned: evidence?.owned ?? null,
    ownedReason: evidence?.ownedReason,
    libraryMatch: evidence?.libraryMatch,
    reviewDecision: evidence?.reviewDecision,
  } as PlaylistRow;
  const updated =
    !!current &&
    !!item.evidence &&
    (current.checkedAt !== item.evidence.checkedAt ||
      current.libraryFingerprint !== item.evidence.libraryFingerprint ||
      current.owned !== item.evidence.owned ||
      current.ownedReason !== item.evidence.ownedReason ||
      current.reviewDecision?.action !== item.evidence.reviewDecision?.action);
  return (
    <li className="py-3 first:pt-0">
      <TrackIdentity
        track={item}
        onInspect={() => setOpen(!open)}
        expanded={open}
        controls={id}
      />
      <div className="mt-2 space-y-1 text-sm leading-6">
        {!item.evidence && current && (
          <p>{t("Current matching result (no saved snapshot)")}</p>
        )}
        <p className="font-medium text-foreground">
          {t(
            !evidence
              ? "No saved matching evidence"
              : stale
                ? "Needs recheck"
                : libraryMatchLabel(row),
          )}
        </p>
        <p>
          {t(
            !evidence
              ? "This older saved track has no matching evidence. Check it with your XML before buying."
              : stale
                ? "This result used older matching rules. Check again with your XML before buying."
                : libraryMatchExplanation(row),
          )}
        </p>
        {updated && (
          <p className="text-review">
            {t("A newer matching result is shown. Review it before buying.")}
          </p>
        )}
        {evidence && (
          <p className="text-muted">
            {evidence.xmlFilename || t("XML")}
            {evidence.checkedAt &&
            Number.isFinite(Date.parse(evidence.checkedAt))
              ? ` · ${new Date(evidence.checkedAt).toLocaleString(language === "ja" ? "ja-JP" : "en-GB")}`
              : ""}
          </p>
        )}
      </div>
      <div
        id={id}
        hidden={!open}
        className="mt-3 border-l border-white/20 pl-3 text-sm"
      >
        <RecordingComparison track={row} />
        <TrackSourceLink track={row} />
        {item.evidence && updated && (
          <p>
            {t("Saved decision:")}{" "}
            {t(libraryMatchLabel({ ...row, ...item.evidence }))}
          </p>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <TrackStoreLinks
          track={{
            ...item,
            stores:
              item.buyStore === "Beatport"
                ? { beatport: item.buyUrl }
                : { bandcamp: item.buyUrl },
          }}
        />
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          aria-label={t("Remove {title} from Buy Later", { title: item.title })}
          className="ps-action-secondary ml-auto"
        >
          {t("Remove")}
        </button>
      </div>
    </li>
  );
}
