'use client';

import React, {
  useState,
  ChangeEvent,
  FormEvent,
} from 'react';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://127.0.0.1:8000';

// ==== Types (match backend) ====

type StoreLinks = {
  beatport: string;
  bandcamp: string;
  itunes: string;
};

type ApiTrack = {
  title: string;
  artist: string;
  album: string;
  isrc?: string | null;
  spotify_url: string;
  apple_url?: string | null;
  links: StoreLinks;
};

type ApiPlaylistResponse = {
  playlist_id: string;
  playlist_name: string;
  playlist_url: string;
  tracks: ApiTrack[];
};

type PlaylistRow = {
  index: number;
  title: string;
  artist: string;
  album: string;
  isrc?: string;
  spotifyUrl: string;
  appleUrl?: string;
  stores: StoreLinks;
  owned?: boolean; // Whether present in Rekordbox
};

type ResultState = {
  title: string;
  total: number;
  playlistUrl: string;
  tracks: PlaylistRow[];
};

type RekordboxTrack = {
  title: string;
  artist: string;
  album?: string;
  isrc?: string | null;
};

// ==== Rekordbox XML parsing & key generation ====

function normalizeKey(input: string): string {
  return input
  // Basic normalization: NFKC + lowercase, strip spaces and non-alphanumerics.
  // Using a conservative ASCII-only cleanup to avoid relying on Unicode
  // property escapes which may not be available in all environments.
  // Prefer Unicode-aware cleanup (letters + numbers). Fall back to ASCII-only.
  try {
    const n = input.normalize('NFKC').toLowerCase();
    return n.replace(/\s+/g, '').replace(/[^\p{L}\p{N}]/gu, '');
  } catch (e) {
    return input
      .toLowerCase()
      .normalize('NFKC')
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9]/g, '');
  }
}

function buildTrackKey(
  title: string,
  artist: string,
  isrc?: string | null
): string {
  const base = `${normalizeKey(title)}::${normalizeKey(artist)}`;
  return isrc ? `${base}::${isrc.toUpperCase()}` : base;
}

function parseRekordboxXml(text: string): RekordboxTrack[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/xml');

  // Parse error detection
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error(
      'Failed to parse Rekordbox XML. Please provide a collection.xml file.'
    );
  }

  const tracks: RekordboxTrack[] = [];
  const nodes = Array.from(doc.getElementsByTagName('TRACK'));

  for (const node of nodes) {
    const title = node.getAttribute('Name') ?? '';
    const artist = node.getAttribute('Artist') ?? '';
    const album = node.getAttribute('Album') ?? undefined;
    const isrc = node.getAttribute('ISRC') ?? undefined;

    if (!title || !artist) continue;

    tracks.push({ title, artist, album, isrc });
  }

  return tracks;
}

// ==== Main component ====

export default function Page() {
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [rekordboxFile, setRekordboxFile] = useState<File | null>(null);
  const [onlyUnowned, setOnlyUnowned] = useState(false);
  const [source, setSource] = useState<'spotify' | 'apple'>('spotify');

  function detectSourceFromUrl(u: string): 'spotify' | 'apple' {
    const s = (u || '').trim();
    if (!s) return 'spotify';
    try {
      const lower = s.toLowerCase();
      if (lower.includes('music.apple.com')) return 'apple';
      if (lower.includes('open.spotify.com')) return 'spotify';
      // spotify id (22 chars) heuristic
      const m = s.match(/([A-Za-z0-9]{22})/);
      if (m) return 'spotify';
    } catch (e) {
      // ignore
    }
    return 'spotify';
  }

  const [result, setResult] = useState<ResultState | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const progressTimer = React.useRef<number | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const handlePlaylistChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setPlaylistUrl(v);
    // auto-detect source from typed/pasted URL
    const detected = detectSourceFromUrl(v);
    setSource(detected);
  };

  const handleRekordboxChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setRekordboxFile(file);
  };

  const handleAnalyze = async (e: FormEvent) => {
    e.preventDefault();
    setErrorText(null);
    setResult(null);

    // sanitize input: trim, strip surrounding <> and quotes (users often paste with <>)
    let trimmed = playlistUrl.trim();
    if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
      trimmed = trimmed.slice(1, -1).trim();
    }
    trimmed = trimmed.replace(/^['"]+|['"]+$/g, '').trim();
    if (!trimmed) {
      setErrorText(source === 'apple' ? 'Please enter an Apple Music playlist URL.' : 'Please enter a Spotify playlist URL or ID.');
      return;
    }

    // determine effective source (re-validate at submit time)
    let effectiveSource = detectSourceFromUrl(trimmed) || source;
    // If the URL clearly points to Apple Music, force apple to avoid mis-detection
    if (/music\.apple\.com/i.test(trimmed)) {
      effectiveSource = 'apple';
    }
    if (effectiveSource === 'spotify') {
      // Accept a broader set of Spotify playlist URL forms, including
      // user playlist URLs (open.spotify.com/user/.../playlist/...),
      // query-string variants, raw 22-char IDs, and spotify:playlist: URIs.
      const isSpotifyPlaylistUrl = /open\.spotify\.com\/.*playlist\//i.test(trimmed);
      const isSpotifyUri = /^spotify:playlist:[A-Za-z0-9]{22}$/i.test(trimmed);
      const isIdOnly = /^[A-Za-z0-9]{22}$/.test(trimmed);
      if (!isSpotifyPlaylistUrl && !isSpotifyUri && !isIdOnly) {
        setErrorText('Unsupported Spotify playlist URL or ID. Please provide a playlist URL (e.g. https://open.spotify.com/playlist/... or user/.../playlist/...) or a 22-character playlist ID.');
        return;
      }
    }

    setLoading(true);
    // start simulated progress
    setProgress(2);
    if (progressTimer.current) {
      window.clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
    progressTimer.current = window.setInterval(() => {
      setProgress((p) => {
        // increase by random small amount, cap at 98 while waiting
        const next = Math.min(98, p + Math.random() * 12 + 3);
        return next;
      });
    }, 300) as unknown as number;

    // Log what we're about to send so it's easy to trace from the browser console
    console.debug('Submitting playlist request', { url: trimmed, effectiveSource, rekordboxFile: !!rekordboxFile });

    try {
      // If a Rekordbox XML file is provided, upload it to the backend
      // and let the backend compute the `owned` flags reliably.
      let res: Response;
      // determine effective source (re-validate at submit time)
      const effectiveSource = detectSourceFromUrl(trimmed) || source;

      if (rekordboxFile) {
        const form = new FormData();
        form.append('url', trimmed);
        // include source and append both file field names to be tolerant
        form.append('source', effectiveSource);
        form.append('file', rekordboxFile);
        form.append('rekordbox_xml', rekordboxFile);

        console.debug('POST multipart -> /api/playlist-with-rekordbox-upload');
        res = await fetch(`${BACKEND_URL}/api/playlist-with-rekordbox-upload`, {
          method: 'POST',
          body: form,
        });
      } else {
        const effectiveSource = detectSourceFromUrl(trimmed) || source;
        const params = new URLSearchParams({ url: trimmed, source: effectiveSource });
        console.debug('GET -> /api/playlist', `${BACKEND_URL}/api/playlist?${params.toString()}`);
        res = await fetch(`${BACKEND_URL}/api/playlist?${params.toString()}`);
      }

      // Read raw text first and try to parse JSON; this surfaces non-JSON errors too
      let body: any = null;
      let rawText: string | null = null;
      try {
        rawText = await res.text();
        try {
          body = rawText ? JSON.parse(rawText) : null;
        } catch (e) {
          body = rawText;
        }
      } catch (e) {
        // ignore
      }

      if (!res.ok) {
        let message = `Request failed: ${res.status}`;
        if (Array.isArray(body)) {
          message = body.map((e: any) => e?.msg ?? JSON.stringify(e)).join('\n') || message;
        } else if (body?.detail) {
          message = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
        } else if (typeof body === 'string' && body.trim()) {
          message = body;
        }

        console.error('Server responded with non-OK status:', res.status, body, 'rawText:', rawText);
        throw new Error(message);
      }

      const json = body as ApiPlaylistResponse;

      // ensure progress reaches 100% on success
      setProgress(100);
      if (progressTimer.current) {
        window.clearInterval(progressTimer.current);
        progressTimer.current = null;
      }
      // hide progress after a short delay
      setTimeout(() => setProgress(0), 600);

      // Build rows from the server response; backend sets `owned` when file uploaded.
      const rows: PlaylistRow[] = json.tracks.map((t, idx) => ({
        index: idx + 1,
        title: t.title,
        artist: t.artist,
        album: t.album,
        isrc: t.isrc ?? undefined,
        spotifyUrl: t.spotify_url ?? '',
        appleUrl: (t as any).apple_url ?? undefined,
        stores: t.links ?? { beatport: '', bandcamp: '', itunes: '' },
        owned: (t as any).owned ?? undefined,
      }));

      setResult({
        title: json.playlist_name,
        total: rows.length,
        playlistUrl: json.playlist_url,
        tracks: rows,
      });
    } catch (err: any) {
      console.error(err);
      setErrorText(err?.message ?? 'An unknown error occurred.');
    } finally {
      setLoading(false);
      if (progressTimer.current) {
        window.clearInterval(progressTimer.current);
        progressTimer.current = null;
      }
      // if we finished without setting to 100 (error), animate to 100 then hide
      if (!errorText) {
        setProgress(100);
        setTimeout(() => setProgress(0), 600);
      } else {
        setTimeout(() => setProgress(0), 600);
      }
    }
  };

  const displayedTracks: PlaylistRow[] =
    result?.tracks
      ? onlyUnowned
        ? result.tracks.filter((t) => t.owned === false)
        : result.tracks
      : [];

  const unownedCount = result ? result.tracks.filter((t) => t.owned === false).length : 0;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">
                  Playlist Shopper — Spotify & Apple Music
                </h1>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Fetch a playlist from Spotify or Apple Music and optionally upload
                  your Rekordbox collection XML to mark tracks as Owned / Not owned.
                  The app also generates Beatport, Bandcamp and iTunes search links.
                </p>
        </header>

        {/* Form */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-xl p-6 space-y-4">
          <form onSubmit={handleAnalyze} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Playlist URL or ID
              </label>
              <input
                type="text"
                value={playlistUrl}
                onChange={handlePlaylistChange}
                className="w-full rounded-md border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="https://open.spotify.com/playlist/... or Apple Music URL"
              />
              <p className="text-xs text-slate-400">
                Full URL or playlist ID both work.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Rekordbox Collection XML (optional)
              </label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <input
                  type="file"
                  accept=".xml"
                  onChange={handleRekordboxChange}
                  className={
                    "text-xs text-slate-200 cursor-pointer " +
                    "file:mr-3 file:rounded-md file:border-0 " +
                    "file:bg-emerald-500 file:px-3 file:py-1 " +
                    "file:text-xs file:font-semibold file:text-slate-900 " +
                    "hover:file:bg-emerald-400"
                  }
                />
                <span className="text-xs text-slate-400">
                  Upload your Rekordbox collection XML to mark Owned / Not owned.
                  If not provided, the app will only fetch the playlist.
                </span>
              </div>
              {rekordboxFile && (
                <p className="text-xs text-emerald-300">
                  Selected: {rekordboxFile.name}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={onlyUnowned}
                  onChange={(e) => setOnlyUnowned(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-emerald-500"
                />
                <span>Show only unowned tracks</span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-black hover:bg-emerald-400 disabled:opacity-60"
              >
                {loading ? 'Analyzing…' : 'Analyze'}
              </button>
            </div>
          </form>

          {errorText && (
            <div className="mt-4 rounded-md border border-red-500/60 bg-red-900/30 px-3 py-2 text-xs whitespace-pre-wrap">
              {errorText}
            </div>
          )}
        </section>
          {/* Progress bar */}
          {loading && (
            <div className="mt-2">
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-2 bg-emerald-500 transition-all duration-200"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progress)}
                  style={{ width: `${Math.round(progress)}%` }}
                />
              </div>
            </div>
          )}

        {/* Results */}
        {result && (
          <section className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
              <div className="space-y-1">
                <div className="text-sm text-slate-400">
                  Total {result.total} tracks — Displaying {displayedTracks.length} — Unowned {unownedCount}
                </div>
                <h2 className="font-semibold">
                  {result.title}{' '}
                  {result.playlistUrl && (
                    <a
                      href={result.playlistUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-emerald-300 hover:underline ml-2"
                    >
                      Open in Spotify
                    </a>
                  )}
                </h2>
              </div>
            </div>

            {/* Mobile: card list (compact view) */}
            <div className="md:hidden space-y-2">
              {displayedTracks.map((t) => {
                const trackUrl = t.spotifyUrl || t.appleUrl || undefined;
                return (
                <div
                  key={`${trackUrl ?? ''}-${t.index}-${t.isrc ?? ''}`}
                  className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <a
                      href={trackUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-emerald-200 hover:underline"
                    >
                      {t.title}
                    </a>
                    <div>
                      {t.owned === true ? (
                        <span className="inline-flex items-center justify-center rounded-full border border-emerald-500/70 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                          Owned
                        </span>
                      ) : t.owned === false ? (
                        <span className="inline-flex items-center justify-center rounded-full border border-rose-500/70 bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-300">
                          Not owned
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center rounded-full border border-slate-500/70 bg-slate-500/10 px-2.5 py-0.5 text-xs font-medium text-slate-200">
                          Unknown
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-1 text-slate-300">{t.artist}</div>
                  <div className="mt-1 text-slate-400 text-xs">{t.album}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {t.stores.beatport && (
                      <a
                        href={t.stores.beatport}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center rounded-full border border-slate-600 px-2 py-0.5 hover:bg-slate-700"
                      >
                        <span className="text-[10px]">Beatport</span>
                      </a>
                    )}
                    {t.stores.bandcamp && (
                      <a
                        href={t.stores.bandcamp}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center rounded-full border border-slate-600 px-2 py-0.5 hover:bg-slate-700"
                      >
                        <span className="text-[10px]">Bandcamp</span>
                      </a>
                    )}
                    {t.stores.itunes && (
                      <a
                        href={t.stores.itunes}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center rounded-full border border-slate-600 px-2 py-0.5 hover:bg-slate-700"
                      >
                        <span className="text-[10px]">iTunes</span>
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
            </div>

            <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/70">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-900/90">
                  <tr className="border-b border-slate-800 text-slate-300">
                    <th className="px-3 py-2 text-left w-10">#</th>
                    <th className="px-3 py-2 text-left">Title</th>
                    <th className="px-3 py-2 text-left">Artist</th>
                    <th className="px-3 py-2 text-left">Album</th>
                    <th className="px-3 py-2 text-left">ISRC</th>
                    <th className="px-3 py-2 text-center">Owned</th>
                    <th className="px-3 py-2 text-left">Stores</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedTracks.map((t) => {
                    const trackUrl = t.spotifyUrl || t.appleUrl || undefined;
                    return (
                      <tr
                        key={`${trackUrl ?? ''}-${t.index}-${t.isrc ?? ''}`}
                        className="border-b border-slate-800/70 hover:bg-slate-800/40 even:bg-slate-900/60"
                      >
                        <td className="px-3 py-1 text-slate-400">
                          {t.index}
                        </td>
                        <td className="max-w-xs px-3 py-1 text-sm font-medium text-emerald-100">
                          <a
                            href={trackUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="truncate hover:underline block"
                            title={t.title}
                          >
                            {t.title}
                          </a>
                        </td>
                        <td className="max-w-xs px-3 py-1 text-sm text-slate-300">
                          <div className="truncate" title={t.artist}>{t.artist}</div>
                        </td>
                        <td className="max-w-xs px-3 py-1 text-xs text-slate-300">
                          <div className="line-clamp-2" title={t.album}>{t.album}</div>
                        </td>
                        <td className="px-3 py-1 text-slate-400">
                          {t.isrc ?? ''}
                        </td>
                        <td className="px-3 py-1 text-center">
                          {t.owned === true ? (
                            <span className="inline-flex items-center justify-center rounded-full border border-emerald-500/70 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                              Owned
                            </span>
                          ) : t.owned === false ? (
                            <span className="inline-flex items-center justify-center rounded-full border border-rose-500/70 bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-300">
                              Not owned
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center rounded-full border border-slate-500/70 bg-slate-500/10 px-2.5 py-0.5 text-xs font-medium text-slate-200">
                              Unknown
                            </span>
                          )}
                        </td>
                          <td className="px-3 py-1">
                          <div className="flex flex-wrap gap-2">
                            {t.stores.beatport && (
                              <a
                                href={t.stores.beatport}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center rounded-full border border-slate-600 px-2 py-0.5 hover:bg-slate-700"
                              >
                                <span className="text-[10px]">
                                  Beatport
                                </span>
                              </a>
                            )}
                            {t.stores.bandcamp && (
                              <a
                                href={t.stores.bandcamp}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center rounded-full border border-slate-600 px-2 py-0.5 hover:bg-slate-700"
                              >
                                <span className="text-[10px]">
                                  Bandcamp
                                </span>
                              </a>
                            )}
                            {t.stores.itunes && (
                              <a
                                href={t.stores.itunes}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center rounded-full border border-slate-600 px-2 py-0.5 hover:bg-slate-700"
                              >
                                <span className="text-[10px]">
                                  iTunes
                                </span>
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
