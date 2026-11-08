"use client";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { purchaseLinks } from "@/lib/domain/purchaseLinks";
import type { PlaylistRow } from "@/lib/types";
type Identity = Pick<PlaylistRow, "title" | "artist"> &
  Partial<Pick<PlaylistRow, "album" | "spotifyUrl">>;
export function TrackName({ track }: { track: Identity }) {
  const { t } = useI18n();
  const href =
    track.spotifyUrl ||
    `https://music.youtube.com/search?q=${encodeURIComponent(`${track.artist} ${track.title} topic`)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={track.title}
      aria-label={t("Listen to {title}", { title: track.title })}
      className="line-clamp-2 break-words text-base font-medium leading-6 text-white underline decoration-white/20 underline-offset-4 hover:decoration-white/60 focus-visible:outline-2 focus-visible:outline-emerald-300"
    >
      {track.title}
    </a>
  );
}
export function TrackIdentity({ track }: { track: Identity }) {
  return (
    <div className="min-w-0">
      <TrackName track={track} />
      <p className="mt-1 truncate text-sm text-slate-300" title={track.artist}>
        {track.artist}
      </p>
      {track.album &&
        track.album.trim().toLowerCase() !==
          track.title.trim().toLowerCase() && (
          <p
            className="mt-0.5 truncate text-xs text-slate-500"
            title={track.album}
          >
            {track.album}
          </p>
        )}
    </div>
  );
}
export function TrackStoreLinks({
  track,
}: {
  track: Parameters<typeof purchaseLinks>[0];
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {purchaseLinks(track).map((link) => (
        <a
          key={link.name}
          href={link.url}
          target="_blank"
          rel="noreferrer"
          title={t(
            link.product
              ? "Track page · same version not verified"
              : "Search only · availability not verified",
          )}
          className={
            link.name === "Beatport"
              ? "inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-md border border-emerald-400/35 bg-emerald-400/10 px-3 py-2 text-sm font-medium text-emerald-100 hover:border-emerald-400/60 hover:bg-emerald-400/20 focus-visible:outline-2 focus-visible:outline-emerald-300"
              : "inline-flex min-h-9 items-center text-xs text-slate-400 underline decoration-white/20 underline-offset-4 hover:text-white"
          }
        >
          {t(link.label)}
        </a>
      ))}
    </div>
  );
}
