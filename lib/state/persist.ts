// lib/state/persist.ts
export type PersistState = {
  activeTab?: string;
  lastPlaylistUrl?: string;
  lastRunAt?: number;
};

// Persist feature removed (no-op).
export function loadPersist(): PersistState | null {
  return null;
}

export function savePersist(_state: PersistState) {}

export function clearPersist() {}
