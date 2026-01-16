"use client";
import { useState, useEffect } from "react";
import { z } from "zod";

// --- Gate-1 / FE-1: zod boundary validation for localStorage ---
const ActiveTabStorageSchema = z.string().trim().min(1).max(64);
const BoolStringSchema = z.enum(["true", "false"]);

function parseStoredActiveTab(v: string | null): string | null {
  const parsed = ActiveTabStorageSchema.safeParse(v);
  return parsed.success ? parsed.data : null;
}

function parseStoredBool(v: string | null): boolean | null {
  const parsed = BoolStringSchema.safeParse(v);
  return parsed.success ? parsed.data === "true" : null;
}

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
  initialFormCollapsed: boolean,
) {
  // Persist activeTab in localStorage
  const [activeTab, setActiveTab] = useState<string | null>(() => {
    if (typeof window === "undefined") return initialActiveTab;
    try {
      const stored = localStorage.getItem("spotify-shopper-active-tab");
      const parsedTab = parseStoredActiveTab(stored);
      return stored !== null ? stored : initialActiveTab;
    } catch {
      return initialActiveTab;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (activeTab !== null) {
        localStorage.setItem("spotify-shopper-active-tab", activeTab);
      } else {
        localStorage.removeItem("spotify-shopper-active-tab");
      }
    } catch {}
  }, [activeTab]);
  const [openStoreDropdown, setOpenStoreDropdown] = useState<string | null>(
    null,
  );
  // Persist formCollapsed in localStorage
  const [formCollapsed, setFormCollapsed] = useState(() => {
    if (typeof window === "undefined") return initialFormCollapsed;
    try {
      const stored = localStorage.getItem("spotify-shopper-form-collapsed");
      const parsedCollapsed = parseStoredBool(stored);
      return stored !== null ? stored === "true" : initialFormCollapsed;
    } catch {
      return initialFormCollapsed;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        "spotify-shopper-form-collapsed",
        String(formCollapsed),
      );
    } catch {}
  }, [formCollapsed]);

  return {
    activeTab,
    setActiveTab,
    openStoreDropdown,
    setOpenStoreDropdown,
    formCollapsed,
    setFormCollapsed,
  };
}
