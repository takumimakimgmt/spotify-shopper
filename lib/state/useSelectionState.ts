"use client";
import { useState } from 'react';

export interface SelectionState {
  activeTab: string | null;
  setActiveTab: (value: string | null) => void;
  openStoreDropdown: string | null;
  setOpenStoreDropdown: (value: string | null) => void;
  formCollapsed: boolean;
  setFormCollapsed: (value: boolean) => void;
}

/**
 * Encapsulates tab/modal/dropdown selection state for the UI.
 * Separate from analyzer to avoid polluting core domain logic.
 */
export function useSelectionState(
  initialActiveTab: string | null,
  initialFormCollapsed: boolean
) {
  const [activeTab, setActiveTab] = useState<string | null>(initialActiveTab);
  const [openStoreDropdown, setOpenStoreDropdown] = useState<string | null>(null);
  const [formCollapsed, setFormCollapsed] = useState(initialFormCollapsed);

  return {
    activeTab,
    setActiveTab,
    openStoreDropdown,
    setOpenStoreDropdown,
    formCollapsed,
    setFormCollapsed,
  };
}
