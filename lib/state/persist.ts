// lib/state/persist.ts
export type PersistState = {
  activeTab?: string;          // e.g. "analyze" | "results" | "unowned"
  lastPlaylistUrl?: string;    // the last analyzed playlist URL
  lastRunAt?: number;          // Date.now()
};

const KEY = "playlist-shopper:persist:v1";

export function loadPersist(): PersistState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistState;
  } catch {
    return null;
  }
}

export function savePersist(state: PersistState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore quota / privacy mode
  }
}

export function clearPersist() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
