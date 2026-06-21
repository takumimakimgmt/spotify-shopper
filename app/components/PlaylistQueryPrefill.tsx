"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { playlistFromSearchParams } from "@/lib/utils/desktopHandoff";

export default function PlaylistQueryPrefill({
  setPlaylistUrlInput,
}: {
  setPlaylistUrlInput: (value: string) => void;
}) {
  const searchParams = useSearchParams();
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current) return;
    applied.current = true;

    const playlist = playlistFromSearchParams(searchParams);
    if (playlist) setPlaylistUrlInput(playlist);
  }, [searchParams, setPlaylistUrlInput]);

  return null;
}
