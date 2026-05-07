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
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is BuyQueueItem =>
        typeof item?.id === "string" &&
        typeof item?.title === "string" &&
        typeof item?.artist === "string" &&
        typeof item?.buyUrl === "string" &&
        typeof item?.buyStore === "string" &&
        typeof item?.addedAt === "number",
    );
  } catch {
    return [];
  }
}

function saveQueue(items: BuyQueueItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function useBuyQueue() {
  const [items, setItems] = useState<BuyQueueItem[]>(() => {
    if (typeof window === "undefined") return [];
    return parseQueue(window.localStorage.getItem(STORAGE_KEY));
  });

  useEffect(() => {
    saveQueue(items);
  }, [items]);

  const queuedIds = useMemo(
    () => new Set(items.map((item) => item.id)),
    [items],
  );

  const addTrack = useCallback(
    (track: PlaylistRow, buyLink: { name: string; url: string }) => {
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
    [],
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  return {
    items,
    queuedIds,
    addTrack,
    removeItem,
  };
}

export function getBuyQueueItemId(track: PlaylistRow) {
  return itemId(track);
}
