"use client";
import { useState } from 'react';
import type { SortKey } from '../types';

export interface FiltersState {
  categoryFilter: 'all' | 'toBuy' | 'owned';
  setCategoryFilter: (value: 'all' | 'toBuy' | 'owned') => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  sortKey: SortKey;
  setSortKey: (value: SortKey) => void;
  onlyUnowned: boolean;
  setOnlyUnowned: (value: boolean) => void;
}

/**
 * Encapsulates all filtering/sorting UI state (category, search, sort, onlyUnowned).
 * Consumed by FiltersBar and ResultsTable filtering logic.
 */
export function useFiltersState(initialOnlyUnowned = false) {
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'toBuy' | 'owned'>('toBuy');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('none');
  const [onlyUnowned, setOnlyUnowned] = useState<boolean>(initialOnlyUnowned);

  return {
    categoryFilter,
    setCategoryFilter,
    searchQuery,
    setSearchQuery,
    sortKey,
    setSortKey,
    onlyUnowned,
    setOnlyUnowned,
  };
}
