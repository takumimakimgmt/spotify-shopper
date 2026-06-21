"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  buildDesktopHandoffLink,
  isValidSpotifyPlaylistInput,
} from "@/lib/utils/desktopHandoff";

export default function MobileDesktopHandoff({
  playlistInput,
  focusPlaylistInput,
}: {
  playlistInput: string;
  focusPlaylistInput: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );
  const valid = isValidSpotifyPlaylistInput(playlistInput);
  const desktopLink = useMemo(() => {
    if (!valid || typeof window === "undefined") return "";
    return buildDesktopHandoffLink(window.location.origin, playlistInput);
  }, [playlistInput, valid]);

  const copyDesktopLink = async () => {
    if (!desktopLink) return;
    await navigator.clipboard.writeText(desktopLink);
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  const emailHref = desktopLink
    ? `mailto:?subject=${encodeURIComponent("Playlist Shopper desktop link")}&body=${encodeURIComponent(
        `Open this on your computer:\n${desktopLink}\n\nThen export your Rekordbox XML and upload it to check which tracks are missing.`,
      )}`
    : undefined;

  return (
    <aside className="rounded-xl border border-sky-400/20 bg-sky-400/[0.06] p-5 md:hidden">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-white">
          Use this on your computer
        </h2>
        <p className="text-sm leading-6 text-slate-300">
          Playlist Shopper needs your Rekordbox XML, so the final check works
          best on desktop.
        </p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={focusPlaylistInput}
          className="rounded-md border border-white/15 px-3 py-2 text-sm font-medium text-slate-100 hover:border-white/30"
        >
          Paste playlist
        </button>
        <button
          type="button"
          onClick={copyDesktopLink}
          disabled={!desktopLink}
          className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-200 disabled:bg-white/10 disabled:text-white/30"
        >
          {copied ? "Copied" : "Copy desktop link"}
        </button>
        <a
          href={emailHref}
          aria-disabled={!emailHref}
          onClick={(event) => {
            if (!emailHref) event.preventDefault();
          }}
          className={`rounded-md border px-3 py-2 text-sm font-medium ${
            emailHref
              ? "border-white/15 text-slate-100 hover:border-white/30"
              : "pointer-events-none border-white/5 text-white/30"
          }`}
        >
          Email to myself
        </a>
      </div>
      {!playlistInput.trim() ? (
        <p className="mt-3 text-xs text-slate-400">
          Paste a playlist first to create your desktop link.
        </p>
      ) : !valid ? (
        <p className="mt-3 text-xs text-rose-300">
          Enter a valid Spotify playlist URL, URI, or ID first.
        </p>
      ) : null}
    </aside>
  );
}
