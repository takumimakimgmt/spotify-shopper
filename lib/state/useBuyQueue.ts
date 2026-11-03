"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PlaylistRow } from "../types";

const STORAGE_KEY = "playlist-shopper-buy-queue";

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
};

function itemId(track: PlaylistRow) {
  const isrc = track.isrc?.trim();
  if (isrc) return `isrc:${isrc.toLowerCase()}`;
  return [
    "track",
    track.artist?.trim().toLowerCase() ?? "",
    track.title?.trim().toLowerCase() ?? "",
    track.album?.trim().toLowerCase() ?? "",
  ].join(":");
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
  return parsed;
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
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const restore = useCallback(() => {
    try {
      setItems(parseQueue(window.localStorage.getItem(STORAGE_KEY)));
      setRestored(true);
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

  const queuedIds = useMemo(
    () => new Set(items.map((item) => item.id)),
    [items],
  );

  const addTrack = useCallback(
    (track: PlaylistRow, buyLink: { name: string; url: string }) => {
      if (!restored) {
        setStorageWarning(
          "Buy Later is not ready. Retry loading saved tracks first.",
        );
        return;
      }
      const nextItem: BuyQueueItem = {
        id: itemId(track),
        title: track.title,
        artist: track.artist,
        album: track.album,
        isrc: track.isrc,
        spotifyUrl: track.spotifyUrl,
        buyUrl: buyLink.url,
        buyStore: buyLink.name,
        addedAt: Date.now(),
      };

      setItems((prev) => {
        if (prev.some((item) => item.id === nextItem.id)) return prev;
        return [nextItem, ...prev];
      });
    },
    [restored],
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  return {
    items,
    queuedIds,
    addTrack,
    removeItem,
    storageWarning,
    retrySave,
  };
}

export function getBuyQueueItemId(track: PlaylistRow) {
  return itemId(track);
}
