"use client";

import { deleteSavedRekordboxXml } from "./savedRekordboxXml";

import { STORAGE_KEYS } from "./keys";

export type ResetScope = "history" | "settings" | "all";
const HISTORY_KEYS = [STORAGE_KEYS.history, STORAGE_KEYS.analysisDraft];
const SETTINGS_KEYS = [STORAGE_KEYS.activeTab, STORAGE_KEYS.formCollapsed];

export async function resetLocalData(scope: ResetScope): Promise<void> {
  // Wait for the XML transaction before reporting a complete reset.
  if (scope === "all") await deleteSavedRekordboxXml();
  const keys =
    scope === "history"
      ? HISTORY_KEYS
      : scope === "settings"
        ? SETTINGS_KEYS
        : [
            ...HISTORY_KEYS,
            ...SETTINGS_KEYS,
            STORAGE_KEYS.buyQueue,
            STORAGE_KEYS.reviewDecisions,
          ];
  for (const key of keys) window.localStorage.removeItem(key);
}
