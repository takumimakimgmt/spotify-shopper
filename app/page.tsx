'use client';

import React, {
  useState,
  ChangeEvent,
  FormEvent,
  useMemo,
} from 'react';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://127.0.0.1:8000';

// ==== Types ====

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
  owned?: boolean | null;
  owned_reason?: string | null;
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
  owned?: boolean | null;
  ownedReason?: string | null;
};

type ResultState = {
  title: string;
  total: number;
  playlistUrl: string;
  tracks: PlaylistRow[];
  analyzedAt: number; // timestamp when analyzed
};

type RekordboxTrack = {
  title: string;
  artist: string;
  album?: string;
  isrc?: string | null;
};

type SortKey = 'none' | 'artist' | 'album' | 'title';

// ==== Rekordbox XML parsing ====

function normalizeKey(input: string): string {
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

// ==== Owned status helper ====

function getOwnedStatusReason(
  owned: boolean | null | undefined,
  ownedReason: string | null | undefined
): { icon: string; label: string; tooltip: string } {
  if (owned === true) {
    const reasonLabel =
      ownedReason === 'isrc'
        ? 'Matched by ISRC'
        : ownedReason === 'exact'
        ? 'Matched by Title + Artist'
        : ownedReason === 'album'
        ? 'Matched by Title + Album'
        : ownedReason === 'fuzzy'
        ? 'Matched by Fuzzy Title + Artist'
        : 'Matched';
    return {
      icon: '🟢',
      label: 'YES',
      tooltip: reasonLabel,
    };
  } else if (owned === false) {
    return {
      icon: '⚪️',
      label: 'NO',
      tooltip: 'Not found in library',
    };
  } else {
    return {
      icon: '🟡',
      label: '?',
      tooltip: 'Maybe (fuzzy match, low confidence)',
    };
  }
}

// ==== Main component ====

export default function Page() {
  // Single/multiple playlist input
  const [playlistUrlInput, setPlaylistUrlInput] = useState('');
  const [rekordboxFile, setRekordboxFile] = useState<File | null>(null);
  const [rekordboxDate, setRekordboxDate] = useState<string | null>(null);
  const [onlyUnowned, setOnlyUnowned] = useState(false);

  // Multi-playlist results: ordered array (newest first)
  const [multiResults, setMultiResults] = useState<Array<[string, ResultState]>>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  // Loading/error state
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [appleNotice, setAppleNotice] = useState(false);

  // Sort/search state
  const [sortKey, setSortKey] = useState<SortKey>('none');
  const [searchQuery, setSearchQuery] = useState('');

  const progressTimer = React.useRef<number | null>(null);

  function detectSourceFromUrl(u: string): 'spotify' | 'apple' {
    const s = (u || '').trim();
    if (!s) return 'spotify';
    try {
      const lower = s.toLowerCase();
      if (lower.includes('music.apple.com')) return 'apple';
      if (lower.includes('open.spotify.com')) return 'spotify';
      const m = s.match(/([A-Za-z0-9]{22})/);
      if (m) return 'spotify';
    } catch (e) {
      // ignore
    }
    return 'spotify';
  }

  function sanitizeUrl(raw: string): string {
    let trimmed = raw.trim();
    if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
      trimmed = trimmed.slice(1, -1).trim();
    }
    trimmed = trimmed.replace(/^['"]+|['"]+$/g, '').trim();
    return trimmed;
  }

  const handleRekordboxChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setRekordboxFile(file);
    
    // Get file's last modified date
    if (file && file.lastModified) {
      const date = new Date(file.lastModified);
      setRekordboxDate(date.toLocaleString());
    } else {
      setRekordboxDate(null);
    }
  };

  const handleAnalyze = async (e: FormEvent) => {
    e.preventDefault();
    setErrorText(null);

    // Parse multiple URLs (one per line)
    const urls = playlistUrlInput
      .split('\n')
      .map((line) => sanitizeUrl(line))
      .filter((url) => url.length > 0);

    if (urls.length === 0) {
      setErrorText('Please enter at least one playlist URL or ID.');
      return;
    }

    setLoading(true);
    setProgress(2);
    if (progressTimer.current) {
      window.clearInterval(progressTimer.current);
    }
    progressTimer.current = window.setInterval(() => {
      setProgress((p) => Math.min(98, p + Math.random() * 12 + 3));
    }, 300) as unknown as number;

    const newResults: Array<[string, ResultState]> = [];
    let hasError = false;

    // Check if any URL is Apple Music and show notice immediately
    const hasApple = urls.some(u => detectSourceFromUrl(u) === 'apple');
    if (hasApple) {
      setAppleNotice(true);
    }

    for (const url of urls) {
      try {
        const effectiveSource = detectSourceFromUrl(url) || 'spotify';

        // Validate
        if (effectiveSource === 'spotify') {
          const isSpotifyPlaylistUrl = /open\.spotify\.com\/.*playlist\//i.test(url);
          const isSpotifyUri = /^spotify:playlist:[A-Za-z0-9]{22}$/i.test(url);
          const isIdOnly = /^[A-Za-z0-9]{22}$/.test(url);
          if (!isSpotifyPlaylistUrl && !isSpotifyUri && !isIdOnly) {
            hasError = true;
            continue;
          }
        }

        // Fetch
        let res: Response;
        if (rekordboxFile) {
          const form = new FormData();
          form.append('url', url);
          form.append('source', effectiveSource);
          form.append('file', rekordboxFile);
          form.append('rekordbox_xml', rekordboxFile);

          res = await fetch(`${BACKEND_URL}/api/playlist-with-rekordbox-upload`, {
            method: 'POST',
            body: form,
          });
        } else {
          const params = new URLSearchParams({ url, source: effectiveSource });
          res = await fetch(`${BACKEND_URL}/api/playlist?${params.toString()}`);
        }

        let body: any = null;
        try {
          const rawText = await res.text();
          body = rawText ? JSON.parse(rawText) : null;
        } catch (e) {
          // ignore
        }

        if (!res.ok) {
          hasError = true;
          // Try to surface more helpful error messages from backend
          try {
            const detail = (body && (body.detail ?? body)) || null;
            const d = (detail && typeof detail === 'object') ? detail as any : null;
            const usedSource: string | undefined = d?.used_source;
            const errText: string | undefined = d?.error ?? (typeof detail === 'string' ? detail : undefined);

            console.log('[DEBUG] Error response:', { detail, usedSource, errText, effectiveSource });

            if (usedSource === 'spotify' || effectiveSource === 'spotify') {
              if (errText) {
                const lower = errText.toLowerCase();
                console.log('[DEBUG] Error text contains:', {
                  personalized: lower.includes('personalized'),
                  private: lower.includes('private'),
                  '37i9': lower.includes('37i9'),
                  workaround: lower.includes('workaround'),
                });

                if (lower.includes('personalized') || lower.includes('private') || lower.includes('daily mix') || lower.includes('blend')) {
                  setErrorText(
                    'このSpotifyプレイリストはパーソナライズ/非公開のため、クライアントクレデンシャルでは取得できません。\n' +
                    'ワークアラウンド: 新しい自分の公開プレイリストを作成し、元のプレイリストから全曲をコピーした上で、その新しいURLを指定してください。'
                  );
                } else if (
                  lower.includes('official editorial') ||
                  lower.includes('owner=spotify') ||
                  lower.includes('region-restricted') ||
                  lower.includes('region-locked') ||
                  lower.includes('tried markets') ||
                  lower.includes('37i9') ||
                  lower.includes('workaround') ||
                  lower.includes('create a new public playlist')
                ) {
                  setErrorText(
                    'このSpotifyの公式/編集プレイリストは、地域制限や提供条件により取得できない場合があります。\n' +
                    '対処: サーバー側の環境変数 SPOTIFY_MARKET を JP や US に切り替えて再試行してください（例: SPOTIFY_MARKET="JP,US,GB"）。\n' +
                    'ワークアラウンド: Spotifyで新しい自分の公開プレイリストを作成し、元プレイリストの曲を全てコピー、そのURLで解析すると成功しやすいです。'
                  );
                } else {
                  setErrorText('Spotifyの取得に失敗しました: ' + errText);
                }
              } else {
                setErrorText('Spotifyの取得に失敗しました（詳細不明）');
              }
            } else {
              // Apple or other source errors
              setErrorText(errText || 'プレイリストの取得に失敗しました');
            }
          } catch (_) {
            // ignore parse issues
            setErrorText('プレイリストの取得に失敗しました');
          }
          continue;
        }

        const json = body as ApiPlaylistResponse;
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
          ownedReason: (t as any).owned_reason ?? undefined,
        }));

        newResults.push([
          url,
          {
            title: json.playlist_name,
            total: rows.length,
            playlistUrl: json.playlist_url,
            tracks: rows,
            analyzedAt: Date.now(),
          },
        ]);
      } catch (err) {
        console.error(err);
        hasError = true;
      }
    }

    if (newResults.length > 0) {
      // Prepend new results (newest first) and keep existing
      const merged = [...newResults, ...multiResults];
      setMultiResults(merged);
      // Set active tab to first (newest) result
      setActiveTab(merged[0][0]);
    }

    // Only show generic error if no specific error was set
    if (hasError && newResults.length === 0 && !errorText) {
      setErrorText('Failed to fetch playlists. Check URLs and try again.');
    }

    setProgress(100);
    setTimeout(() => setProgress(0), 600);

    setLoading(false);
    setAppleNotice(false);
    if (progressTimer.current) {
      window.clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  };

  // Current active result
  const currentResult = multiResults.find(([url]) => url === activeTab)?.[1] ?? null;

  // Filter & sort tracks
  const displayedTracks = useMemo(() => {
    if (!currentResult) return [];

    let filtered = currentResult.tracks;

    // Filter by owned status
    if (onlyUnowned) {
      filtered = filtered.filter((t) => t.owned === false);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.album.toLowerCase().includes(q)
      );
    }

    // Sort
    if (sortKey === 'artist') {
      filtered = [...filtered].sort((a, b) => a.artist.localeCompare(b.artist));
    } else if (sortKey === 'album') {
      filtered = [...filtered].sort((a, b) => a.album.localeCompare(b.album));
    } else if (sortKey === 'title') {
      filtered = [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    }

    return filtered;
  }, [currentResult, onlyUnowned, searchQuery, sortKey]);

  const unownedCount = currentResult
    ? currentResult.tracks.filter((t) => t.owned === false).length
    : 0;

  const handleExportCSV = () => {
    if (!displayedTracks.length || !currentResult) {
      alert('No tracks to export.');
      return;
    }

    const headers = ['#', 'Title', 'Artist', 'Album', 'ISRC', 'Owned', 'Beatport', 'Bandcamp', 'iTunes'];
    const rows = displayedTracks.map((t) => [
      t.index,
      t.title,
      t.artist,
      t.album,
      t.isrc || '',
      t.owned === true ? 'Yes' : t.owned === false ? 'No' : 'Unknown',
      t.stores.beatport,
      t.stores.bandcamp,
      t.stores.itunes,
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Use playlist name in filename
    const safePlaylistName = currentResult.title
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 50);
    a.download = `playlist_${safePlaylistName}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">
            Playlist Shopper — Spotify & Apple Music
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Fetch playlists from Spotify or Apple Music and optionally upload your Rekordbox collection XML
            to mark tracks as Owned / Not owned. The app also generates Beatport, Bandcamp and iTunes search links.
          </p>
        </header>

        {/* Form */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-xl p-6 space-y-4">
          <form onSubmit={handleAnalyze} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Playlist URLs or IDs (one per line)
              </label>
              <textarea
                value={playlistUrlInput}
                onChange={(e) => setPlaylistUrlInput(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono"
                placeholder="https://open.spotify.com/playlist/...&#10;https://music.apple.com/...&#10;3KCXw0N4EJmHIg0KiKjNSM"
                rows={4}
              />
              <p className="text-xs text-slate-400">
                Full URL or playlist ID. Multiple playlists will be analyzed in parallel and results shown in tabs.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Rekordbox Collection XML (optional)
              </label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <input
                  id="rekordbox-file-input"
                  type="file"
                  accept=".xml"
                  onChange={handleRekordboxChange}
                  className="hidden"
                />
                <label
                  htmlFor="rekordbox-file-input"
                  className="inline-flex items-center rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-emerald-400 cursor-pointer"
                >
                  Choose File
                </label>
                <span className="text-xs text-slate-400">
                  Upload your Rekordbox collection XML to mark Owned / Not owned.
                </span>
              </div>
              {rekordboxFile && (
                <div className="text-xs text-emerald-300 space-y-0.5">
                  <p>Selected: {rekordboxFile.name}</p>
                  {rekordboxDate && <p>Date: {rekordboxDate}</p>}
                </div>
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

        {/* Apple Music notice - show immediately when analyzing */}
        {appleNotice && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-200 px-3 py-2 text-xs">
            <div>Apple Music は Spotify より解析に時間がかかります（Webレンダリング + Spotify補完のため）。</div>
            <div className="mt-1">Apple Music takes longer to analyze than Spotify (due to web rendering + Spotify enrichment).</div>
          </div>
        )}

        {/* Progress bar */}
        {loading && (
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
        )}

        {/* Results */}
        {multiResults.length > 0 && (
          <section className="space-y-4">
            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-800">
              {multiResults.map(([url, result]) => {
                const isActive = activeTab === url;
                return (
                  <button
                    key={url}
                    onClick={() => setActiveTab(url)}
                    className={`px-4 py-2 text-sm whitespace-nowrap rounded-t-lg transition ${
                      isActive
                        ? 'bg-emerald-500/20 border-b-2 border-emerald-500 text-emerald-200'
                        : 'bg-slate-800/50 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    {result.title} ({result.total})
                  </button>
                );
              })}
            </div>

            {currentResult && (
              <div className="space-y-4">
                {/* Info & controls */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-sm text-slate-400">
                      Total {currentResult.total} tracks — Displaying {displayedTracks.length} — Unowned {unownedCount}
                    </div>
                    <h2 className="font-semibold">
                      {currentResult.title}{' '}
                      {currentResult.playlistUrl && (
                        <a
                          href={currentResult.playlistUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-emerald-300 hover:underline ml-2"
                        >
                          Open
                        </a>
                      )}
                    </h2>
                  </div>
                </div>

                {/* Search & Sort Controls */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    placeholder="Search tracks (title, artist, album)…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 rounded-md border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                    className="rounded-md border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <option value="none">Sort: None</option>
                    <option value="title">Sort: Title</option>
                    <option value="artist">Sort: Artist</option>
                    <option value="album">Sort: Album</option>
                  </select>
                </div>

                {/* Export Controls */}
                <div className="flex gap-2">
                  <button
                    onClick={handleExportCSV}
                    className="inline-flex items-center rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-500"
                  >
                    Export as CSV
                  </button>
                </div>

                {/* Mobile: card list */}
                <div className="md:hidden space-y-2">
                  {displayedTracks.map((t) => {
                    // Prioritize apple_url for Apple Music playlists, spotify_url for Spotify
                    const isApplePlaylist = currentResult.playlistUrl?.includes('music.apple.com');
                    const trackUrl = isApplePlaylist 
                      ? (t.appleUrl || t.spotifyUrl || undefined)
                      : (t.spotifyUrl || t.appleUrl || undefined);
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
                            {(() => {
                              const status = getOwnedStatusReason(t.owned, t.ownedReason);
                              return (
                                <span
                                  className="inline-flex items-center justify-center text-lg cursor-help"
                                  title={status.tooltip}
                                >
                                  {status.icon}
                                </span>
                              );
                            })()}
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
                    );
                  })}
                </div>

                {/* Desktop: table */}
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
                        // Prioritize apple_url for Apple Music playlists, spotify_url for Spotify
                        const isApplePlaylist = currentResult.playlistUrl?.includes('music.apple.com');
                        const trackUrl = isApplePlaylist 
                          ? (t.appleUrl || t.spotifyUrl || undefined)
                          : (t.spotifyUrl || t.appleUrl || undefined);
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
                              {(() => {
                                const status = getOwnedStatusReason(t.owned, t.ownedReason);
                                return (
                                  <span
                                    className="inline-flex items-center justify-center text-lg cursor-help"
                                    title={status.tooltip}
                                  >
                                    {status.icon}
                                  </span>
                                );
                              })()}
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
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
