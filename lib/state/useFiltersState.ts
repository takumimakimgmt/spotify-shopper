"use client";
import { useState } from "react";
import type { SortKey } from "../types";

export interface FiltersState {
  categoryFilter: "all" | "toBuy" | "owned";
  setCategoryFilter: (value: "all" | "toBuy" | "owned") => void;
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
  const [categoryFilter, setCategoryFilter] = useState<
    "all" | "toBuy" | "owned"
  >("toBuy");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("none");
  return {
    categoryFilter,
    setCategoryFilter,
    searchQuery,
    setSearchQuery,
    sortKey,
    setSortKey,
  };
}
