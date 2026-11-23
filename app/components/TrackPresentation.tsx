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
export function TrackIdentity({
  track,
  onInspect,
  expanded,
  controls,
}: {
  track: Identity;
  onInspect?: () => void;
  expanded?: boolean;
  controls?: string;
}) {
  const { t } = useI18n();
  const Tag = onInspect ? "button" : "div";
  return (
    <Tag
      {...(onInspect
        ? {
            type: "button" as const,
            onClick: onInspect,
            "aria-label": t("Review {title}", { title: track.title }),
            "aria-expanded": expanded,
            "aria-controls": controls,
          }
        : {})}
      className="group/source block min-h-11 min-w-0 w-full rounded text-left"
    >
      <span className="block underline decoration-white/20 underline-offset-4 group-hover/source:decoration-current">
        <TrackName track={track} />
      </span>
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
    </Tag>
  );
}
export function TrackSourceLink({ track }: { track: Identity }) {
  const { t } = useI18n();
  const href =
    track.spotifyUrl ||
    `https://music.youtube.com/search?q=${encodeURIComponent(`${track.artist} ${track.title}`)}`;
  return (
    <a
      className="inline-flex min-h-11 items-center text-sm text-secondary underline underline-offset-4"
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {t(
        track.spotifyUrl
          ? "Open in Spotify (new tab)"
          : "Search YouTube Music (new tab)",
      )}
    </a>
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
