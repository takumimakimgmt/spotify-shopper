const SPOTIFY_PLAYLIST_ID = /^[A-Za-z0-9]{22}$/;
const SPOTIFY_PLAYLIST_URI = /^spotify:playlist:[A-Za-z0-9]{22}$/i;

export function isValidSpotifyPlaylistInput(raw: string): boolean {
  const input = raw.trim();
  if (SPOTIFY_PLAYLIST_ID.test(input) || SPOTIFY_PLAYLIST_URI.test(input)) {
    return true;
  }

  try {
    const url = new URL(input);
    const [, type, id] = url.pathname.split("/");
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      url.hostname.toLowerCase() === "open.spotify.com" &&
      type === "playlist" &&
      SPOTIFY_PLAYLIST_ID.test(id ?? "")
    );
  } catch {
    return false;
  }
}

export function buildDesktopHandoffLink(origin: string, input: string): string {
  return `${origin}?playlist=${encodeURIComponent(input.trim())}`;
}

export type HandoffPlaylistSources = {
  handoffInput?: string | null;
  playlistInput?: string | null;
  activePlaylist?: {
    sourceInput?: string | null;
    playlistInput?: string | null;
    id?: string | null;
  } | null;
  queryPlaylist?: string | null;
};

function handoffPlaylistCandidates({
  handoffInput,
  playlistInput,
  activePlaylist,
  queryPlaylist,
}: HandoffPlaylistSources) {
  return [
    handoffInput,
    playlistInput,
    activePlaylist?.sourceInput,
    activePlaylist?.playlistInput,
    activePlaylist?.id,
    queryPlaylist,
  ];
}

export function hasHandoffPlaylistSource(sources: HandoffPlaylistSources) {
  return handoffPlaylistCandidates(sources).some((candidate) =>
    Boolean(candidate?.trim()),
  );
}

export function getHandoffPlaylistSource(
  sources: HandoffPlaylistSources,
): string | null {
  for (const candidate of handoffPlaylistCandidates(sources)) {
    const source = candidate?.trim();
    if (source && isValidSpotifyPlaylistInput(source)) return source;
  }

  return null;
}

export function playlistFromSearchParams(
  searchParams: Pick<URLSearchParams, "get">,
): string | null {
  const playlist = searchParams.get("playlist");
  return playlist?.trim() ? playlist : null;
}
