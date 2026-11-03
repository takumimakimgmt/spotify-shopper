"use client";

import { deleteSavedRekordboxXml } from "./savedRekordboxXml";

export type ResetScope = "history" | "settings" | "all";
const HISTORY_KEYS = ["spotify-shopper-results"];
const SETTINGS_KEYS = [
  "spotify-shopper-active-tab",
  "spotify-shopper-form-collapsed",
];

export async function resetLocalData(scope: ResetScope): Promise<void> {
  // Wait for the XML transaction before reporting a complete reset.
  if (scope === "all") await deleteSavedRekordboxXml();
  const keys =
    scope === "history"
      ? HISTORY_KEYS
      : scope === "settings"
        ? SETTINGS_KEYS
        : [...HISTORY_KEYS, ...SETTINGS_KEYS, "playlist-shopper-buy-queue"];
  for (const key of keys) window.localStorage.removeItem(key);
}
