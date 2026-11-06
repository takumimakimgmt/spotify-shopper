"use client";

import { useI18n } from "@/lib/i18n/LanguageProvider";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  buildDesktopHandoffLink,
  getHandoffPlaylistSource,
} from "@/lib/utils/desktopHandoff";

export default function MobileDesktopHandoff({
  handoffInput,
  playlistInput,
  activePlaylistInput,
  activePlaylistId,
  queryPlaylist,
}: {
  handoffInput?: string | null;
  playlistInput: string;
  activePlaylistInput?: string | null;
  activePlaylistId?: string | null;
  queryPlaylist?: string | null;
}) {
  const { t: tr } = useI18n();

  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );
  const playlistSources = {
    handoffInput,
    playlistInput,
    activePlaylist: {
      sourceInput: activePlaylistInput,
      id: activePlaylistId,
    },
    queryPlaylist,
  };
  const sourcePlaylistInput = getHandoffPlaylistSource(playlistSources);
  const desktopLink = useMemo(() => {
    if (!sourcePlaylistInput || typeof window === "undefined") return "";
    return buildDesktopHandoffLink(window.location.origin, sourcePlaylistInput);
  }, [sourcePlaylistInput]);

  const copyDesktopLink = async () => {
    if (!desktopLink) return;
    await navigator.clipboard.writeText(desktopLink);
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  const emailHref = desktopLink
    ? `mailto:?subject=${encodeURIComponent("Playlist Shopper desktop link")}&body=${encodeURIComponent(
        `Open this on your computer:\n${desktopLink}\n\nThen export your rekordbox XML and upload it to check which tracks are missing.`,
      )}`
    : undefined;

  if (!sourcePlaylistInput || !desktopLink) return null;

  return (
    <aside className="rounded-lg border border-sky-400/30 bg-sky-400/[0.08] p-4 md:hidden">
      <div className="space-y-2">
        <h2 className="text-base font-semibold text-white">
          {tr("Continue on your computer")}
        </h2>
        <p className="text-sm leading-6 text-slate-200">
          {tr(
            "Send this playlist to the computer that has your rekordbox XML.",
          )}
        </p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copyDesktopLink}
          className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-200"
        >
          {copied ? tr("Copied") : tr("Copy desktop link")}
        </button>
        <a
          href={emailHref}
          className="rounded-md border border-white/20 px-3 py-2 text-sm font-medium text-slate-100 hover:border-white/40"
        >
          {tr("Email to myself")}
        </a>
      </div>
    </aside>
  );
}
