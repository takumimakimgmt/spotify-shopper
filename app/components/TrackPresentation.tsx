"use client";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { purchaseLinks } from "@/lib/domain/purchaseLinks";
import type { PlaylistRow } from "@/lib/types";
type Identity = Pick<PlaylistRow, "title" | "artist"> &
  Partial<Pick<PlaylistRow, "album" | "spotifyUrl">>;
export function TrackName({ track }: { track: Identity }) {
  return (
    <span
      title={track.title}
      className="block break-words [overflow-wrap:anywhere] text-base font-medium leading-6 text-foreground"
    >
      {track.title}
    </span>
  );
}
export function TrackIdentity({ track }: { track: Identity }) {
  const { t } = useI18n();
  const href =
    track.spotifyUrl ||
    `https://music.youtube.com/search?q=${encodeURIComponent(`${track.artist} ${track.title} topic`)}`;
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3">
      <div className="min-w-0">
        <TrackName track={track} />
        <p
          className="mt-1 break-words text-sm leading-5 text-secondary"
          title={track.artist}
        >
          {track.artist}
        </p>
        {track.album &&
          track.album.trim().toLowerCase() !==
            track.title.trim().toLowerCase() && (
            <p
              className="mt-0.5 break-words text-[13px] leading-5 text-muted"
              title={track.album}
            >
              {track.album}
            </p>
          )}
      </div>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-label={t("Listen to {title}", { title: track.title })}
        className="inline-flex min-h-11 shrink-0 items-center self-center rounded px-1 text-sm leading-5 text-muted hover:text-accent"
      >
        {t("Listen")} ↗
      </a>
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
              ? "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md border border-accent/40 bg-accent/5 px-3 py-2 text-sm font-medium text-foreground hover:border-accent hover:bg-accent/15 focus-visible:outline-2 focus-visible:outline-emerald-300"
              : "inline-flex min-h-11 items-center text-sm text-muted underline decoration-white/20 underline-offset-4 hover:text-foreground"
          }
        >
          {t(link.label)}
        </a>
      ))}
    </div>
  );
}
