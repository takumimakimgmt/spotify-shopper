"use client";
import { useState } from "react";
import type { SortKey } from "../types";

export interface FiltersState {
  changesOnly: boolean;
  setChangesOnly: (value: boolean) => void;
  categoryFilter: "all" | "toBuy" | "owned" | "unknown";
  setCategoryFilter: (value: "all" | "toBuy" | "owned" | "unknown") => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  sortKey: SortKey;
  setSortKey: (value: SortKey) => void;
}

/**
 * UI-only filter state for results view.
 * Consumed by FiltersBar and ResultsTable filtering logic.
 */
export function useFiltersState() {
  const [changesOnly, setChangesOnly] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<
    "all" | "toBuy" | "owned" | "unknown"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("none");
  return {
    changesOnly,
    setChangesOnly,
    categoryFilter,
    setCategoryFilter,
    searchQuery,
    setSearchQuery,
    sortKey,
    setSortKey,
  };
}
