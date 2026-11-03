/** Stable keys: migrations must preserve existing data and reset only known records. */
export const STORAGE_KEYS = {
  history: "spotify-shopper-results",
  buyQueue: "playlist-shopper-buy-queue",
  activeTab: "spotify-shopper-active-tab",
  formCollapsed: "spotify-shopper-form-collapsed",
  analysisDraft: "playlist-shopper-analysis-draft",
} as const;
export const MAX_HISTORY_BYTES = 2 * 1024 * 1024;
