"use client";
import type { ReactNode } from "react";
import type { ResultState } from "@/lib/types";
import type { FiltersState } from "@/lib/state/useFiltersState";
import { libraryCheckState, libraryStateHint } from "@/lib/domain/libraryMatch";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import ResultsSearchTools from "./ResultsSearchTools";
export default function ResultsFilterBar({
  result,
  filters,
  queue,
}: {
  result: ResultState;
  filters: FiltersState;
  queue: ReactNode;
}) {
  const { t } = useI18n();
  const counts = { matched: 0, absent: 0, review: 0, unchecked: 0 };
  for (const track of result.tracks) counts[libraryCheckState(track)]++;
  const tabs = [
    ["all", "All", result.tracks.length],
    ["toBuy", "Not in XML", counts.absent],
    ["owned", "Matched / confirmed", counts.matched],
    ["unknown", "Needs review", counts.review],
    ["unchecked", "Not checked", counts.unchecked],
  ] as const;
  const selected = filters.categoryFilter;
  const hint =
    selected === "all"
      ? result.hasRekordboxData
        ? "Choose a category to review matches, missing recordings or versions that need checking."
        : libraryStateHint("unchecked")
      : libraryStateHint(
          (
            {
              toBuy: "absent",
              owned: "matched",
              unknown: "review",
              unchecked: "unchecked",
            } as const
          )[selected],
        );
  return (
    <div className="space-y-2 bg-background lg:sticky lg:top-0 lg:z-20">
      <div className="flex flex-wrap items-end justify-between gap-3 border-y border-white/15 bg-surface p-3">
        <div
          role="group"
          aria-label={t("Track status filter")}
          className="flex flex-wrap gap-1"
        >
          {tabs.map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              aria-pressed={selected === key}
              onClick={() => filters.setCategoryFilter(key)}
              className={`min-h-11 rounded-lg px-3 py-2 text-sm ${selected === key ? "bg-white/10 text-foreground" : "text-muted hover:text-foreground"}`}
            >
              <span>{t(label)}</span>{" "}
              <span className="ml-1 tabular-nums">{count}</span>
            </button>
          ))}
        </div>
        <div className="hidden lg:block">
          <ResultsSearchTools filters={filters} />
        </div>
        <details className="lg:hidden">
          <summary className="min-h-11 cursor-pointer py-3 text-sm text-secondary">
            {t("Search and sort")}
            {filters.searchQuery ? ` · ${filters.searchQuery}` : ""}
          </summary>
          <ResultsSearchTools filters={filters} />
        </details>
        <div className="ml-auto">{queue}</div>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p role="status" className="text-sm leading-6 text-secondary">
          {t(hint)}
        </p>
        {result.meta?.rekordbox?.library_track_count != null && (
          <p className="text-xs text-muted">
            {t("{count} XML entries checked on this device", {
              count: result.meta.rekordbox.library_track_count,
            })}
          </p>
        )}
      </div>
    </div>
  );
}
