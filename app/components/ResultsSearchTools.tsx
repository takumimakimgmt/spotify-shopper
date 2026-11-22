"use client";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import type { FiltersState } from "@/lib/state/useFiltersState";
export default function ResultsSearchTools({
  filters,
}: {
  filters: Pick<
    FiltersState,
    "searchQuery" | "setSearchQuery" | "sortKey" | "setSortKey"
  >;
}) {
  const { t: tr } = useI18n();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(12rem,1fr)_auto]">
      <label className="text-sm font-medium text-secondary">
        <span className="mb-2 block">{tr("Search")}</span>
        <input
          type="search"
          placeholder={tr("Title, artist, or album")}
          value={filters.searchQuery}
          onChange={(e) => filters.setSearchQuery(e.target.value)}
          className="min-h-11 w-full rounded-md border border-[var(--control-border)] bg-transparent px-3 py-2 text-base text-foreground outline-none placeholder:text-muted focus:border-white/40"
        />
      </label>
      <label className="text-sm font-medium text-secondary">
        <span className="mb-2 block">{tr("Sort")}</span>
        <select
          value={filters.sortKey}
          onChange={(e) =>
            filters.setSortKey(e.target.value as typeof filters.sortKey)
          }
          className="min-h-11 w-full rounded-md border border-[var(--control-border)] bg-canvas px-3 py-2 text-base text-foreground outline-none focus:border-white/40"
        >
          <option value="none">{tr("Sort: None")}</option>
          <option value="title">{tr("Sort: Title")}</option>
          <option value="artist">{tr("Sort: Artist")}</option>
          <option value="album">{tr("Sort: Album")}</option>
        </select>
      </label>
    </div>
  );
}
