"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  captureQueueEvidence,
  parseQueueEvidence,
  type QueueContext,
  type QueueEvidence,
} from "../domain/buyQueueEvidence";
import { recordingKey } from "../domain/recordingIdentity";
import type { PlaylistRow } from "../types";

import { STORAGE_KEYS } from "../storage/keys";
const STORAGE_KEY = STORAGE_KEYS.buyQueue;

export type BuyQueueItem = {
  id: string;
  title: string;
  artist: string;
  album?: string;
  isrc?: string;
  spotifyUrl?: string;
  buyUrl: string;
  buyStore: string;
  addedAt: number;
  evidence?: QueueEvidence;
};

function itemId(track: PlaylistRow) {
  return recordingKey(track);
}

function parseQueue(raw: string | null): BuyQueueItem[] {
  if (raw === null) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("Saved purchase queue has an invalid format.");
  }
  const valid = parsed.every(
    (item): item is BuyQueueItem =>
      typeof item?.id === "string" &&
      typeof item?.title === "string" &&
      typeof item?.artist === "string" &&
      typeof item?.buyUrl === "string" &&
      typeof item?.buyStore === "string" &&
      typeof item?.addedAt === "number" &&
      Number.isFinite(item.addedAt),
  );
  if (!valid) throw new Error("Saved purchase queue contains invalid items.");
  return parsed.map((item) => ({
    ...item,
    id: recordingKey(item),
    evidence: parseQueueEvidence(item.evidence),
  }));
}

function saveQueue(items: BuyQueueItem[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

export function useBuyQueue() {
  const [items, setItems] = useState<BuyQueueItem[]>([]);
  const [restored, setRestored] = useState(false);
  const [removed, setRemoved] = useState<
    Array<{ item: BuyQueueItem; index: number }>
  >([]);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const restore = useCallback(() => {
    try {
      setItems(parseQueue(window.localStorage.getItem(STORAGE_KEY)));
      setRestored(true);
      setRemoved([]);
      setStorageWarning(null);
    } catch {
      setStorageWarning(
        "Buy Later could not be read from this browser. Existing saved data has been kept. Retry before saving more tracks.",
      );
    }
  }, []);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      restore();
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, [restore]);

  useEffect(() => {
    if (!restored) return;
    const saved = saveQueue(items);
    const timer = window.setTimeout(
      () =>
        setStorageWarning(
          saved
            ? null
            : "Buy Later is only kept on this page because browser storage failed. Retry saving before closing.",
        ),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [items, restored]);

  const retrySave = useCallback(() => {
    if (!restored) {
      restore();
      return;
    }
    setStorageWarning(
      saveQueue(items)
        ? null
        : "Buy Later could not be saved. Free browser storage and retry.",
    );
  }, [items, restored, restore]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      setRestored(false);
      setStorageWarning(
        "Buy Later changed in another tab. Retry storage to load the latest saved tracks before making changes.",
      );
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const queuedIds = useMemo(
    () => new Set(items.map((item) => item.id)),
    [items],
  );

  const addTracks = useCallback(
    (
      entries: Array<{
        track: PlaylistRow;
        buyLink: { name: string; url: string };
      }>,
      context?: QueueContext,
    ) => {
      if (!restored) {
        setStorageWarning(
          "Buy Later is not ready. Retry loading saved tracks first.",
        );
        return 0;
      }
      const known = new Set(items.map((item) => item.id));
      const additions: BuyQueueItem[] = [];
      for (const { track, buyLink } of entries) {
        const id = itemId(track);
        if (known.has(id)) continue;
        known.add(id);
        additions.push({
          id,
          title: track.title,
          artist: track.artist,
          album: track.album,
          isrc: track.isrc,
          spotifyUrl: track.spotifyUrl,
          buyUrl: buyLink.url,
          buyStore: buyLink.name,
          addedAt: Date.now(),
          evidence: captureQueueEvidence(track, context),
        });
      }
      if (!additions.length) return 0;
      const addedIds = new Set(additions.map((item) => item.id));
      setRemoved((prev) => prev.filter(({ item }) => !addedIds.has(item.id)));
      setItems((prev) => {
        const previous = new Set(prev.map((item) => item.id));
        return [...additions.filter((item) => !previous.has(item.id)), ...prev];
      });
      return additions.length;
    },
    [restored, items],
  );
  const addTrack = useCallback(
    (
      track: PlaylistRow,
      buyLink: { name: string; url: string },
      context?: QueueContext,
    ) => addTracks([{ track, buyLink }], context) > 0,
    [addTracks],
  );

  const removeItem = useCallback(
    (id: string) => {
      if (!restored) {
        setStorageWarning(
          "Buy Later is not ready. Retry loading saved tracks first.",
        );
        return;
      }
      const index = items.findIndex((item) => item.id === id);
      if (index < 0) return;
      setRemoved([{ item: items[index], index }]);
      setItems((prev) => prev.filter((item) => item.id !== id));
    },
    [restored, items],
  );
  const clearItems = useCallback(() => {
    if (!restored) return;
    setRemoved(items.map((item, index) => ({ item, index })));
    setItems([]);
  }, [restored, items]);
  const undoRemove = useCallback(() => {
    if (!restored) return;
    setItems((prev) => {
      const next = [...prev];
      for (const { item, index } of removed) {
        if (!next.some((x) => x.id === item.id))
          next.splice(Math.min(index, next.length), 0, item);
      }
      return next;
    });
    setRemoved([]);
  }, [restored, removed]);

  return {
    items,
    queuedIds,
    addTrack,
    addTracks,
    removeItem,
    clearItems,
    undoRemove,
    removedCount: removed.length,
    storageWarning,
    retrySave,
  };
}

export function getBuyQueueItemId(track: PlaylistRow) {
  return itemId(track);
}
