"use client";
import { useState, useEffect } from "react";
import { z } from "zod";

// --- Gate-1 / FE-1: zod boundary validation for localStorage ---
const ActiveTabStorageSchema = z.string().trim().min(1).max(2048);
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
  // Render the same initial state on the server and first client render.
  // Restore before allowing persistence to avoid overwriting saved selection.
  const [selectionHydrated, setSelectionHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>(initialActiveTab);
  const [formCollapsed, setFormCollapsed] = useState(initialFormCollapsed);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setActiveTab(
          parseStoredActiveTab(
            localStorage.getItem("spotify-shopper-active-tab"),
          ) ?? initialActiveTab,
        );
        setFormCollapsed(
          parseStoredBool(
            localStorage.getItem("spotify-shopper-form-collapsed"),
          ) ?? initialFormCollapsed,
        );
      } catch {
        /* Keep the in-memory initial state when storage is unavailable. */
      }
      setSelectionHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialActiveTab, initialFormCollapsed]);
  useEffect(() => {
    if (typeof window === "undefined" || !selectionHydrated) return;
    try {
      if (activeTab !== null) {
        localStorage.setItem("spotify-shopper-active-tab", activeTab);
      } else {
        localStorage.removeItem("spotify-shopper-active-tab");
      }
    } catch {}
  }, [activeTab, selectionHydrated]);
  useEffect(() => {
    if (typeof window === "undefined" || !selectionHydrated) return;
    try {
      localStorage.setItem(
        "spotify-shopper-form-collapsed",
        String(formCollapsed),
      );
    } catch {}
  }, [formCollapsed, selectionHydrated]);

  return {
    selectionHydrated,
    activeTab,
    setActiveTab,
    formCollapsed,
    setFormCollapsed,
  };
}
