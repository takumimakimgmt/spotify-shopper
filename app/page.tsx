'use client';

import React, {
  useState,
  ChangeEvent,
  FormEvent,
} from 'react';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://127.0.0.1:8000';

// ==== 型定義（バックエンドに合わせる） ====

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
  stores: StoreLinks;
  owned?: boolean; // Rekordbox で持ってるかどうか
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

// ==== Rekordbox XML パース & キー生成 ====

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

  // パースエラー検出
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error(
      'Rekordbox XML の解析に失敗しました。collection.xml を指定してください。'
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

// ==== メインコンポーネント ====

export default function Page() {
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [rekordboxFile, setRekordboxFile] = useState<File | null>(null);
  const [onlyUnowned, setOnlyUnowned] = useState(false);

  const [result, setResult] = useState<ResultState | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const handlePlaylistChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPlaylistUrl(e.target.value);
  };

  const handleRekordboxChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setRekordboxFile(file);
  };

  const handleAnalyze = async (e: FormEvent) => {
    e.preventDefault();
    setErrorText(null);
    setResult(null);

    const trimmed = playlistUrl.trim();
    if (!trimmed) {
      setErrorText('Spotify プレイリストの URL または ID を入力してください。');
      return;
    }

    setLoading(true);

    try {
      // If a Rekordbox XML file is provided, upload it to the backend
      // and let the backend compute the `owned` flags reliably.
      let res: Response;
      if (rekordboxFile) {
        const form = new FormData();
        form.append('url', trimmed);
        // append both 'file' and 'rekordbox_xml' to be tolerant of backend field name
        form.append('file', rekordboxFile);
        form.append('rekordbox_xml', rekordboxFile);

        res = await fetch(`${BACKEND_URL}/api/playlist-with-rekordbox-upload`, {
          method: 'POST',
          body: form,
        });
      } else {
        const params = new URLSearchParams({ url: trimmed });
        res = await fetch(`${BACKEND_URL}/api/playlist?${params.toString()}`);
      }

      let body: any = null;
      try {
        body = await res.json();
      } catch {
        // ignore non-JSON
      }

      if (!res.ok) {
        let message = `Request failed: ${res.status}`;
        // expose validation errors or detail
        if (Array.isArray(body)) {
          message = body.map((e: any) => e?.msg ?? JSON.stringify(e)).join('\n') || message;
        } else if (body?.detail) {
          message = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
        } else if (body) {
          // fallback: stringify entire body for debugging
          try {
            message = JSON.stringify(body);
          } catch (e) {
            // noop
          }
        }

        console.error('Server responded with non-OK status:', res.status, body);
        throw new Error(message);
      }

      const json = body as ApiPlaylistResponse;

      // Build rows from the server response; backend sets `owned` when file uploaded.
      const rows: PlaylistRow[] = json.tracks.map((t, idx) => ({
        index: idx + 1,
        title: t.title,
        artist: t.artist,
        album: t.album,
        isrc: t.isrc ?? undefined,
        spotifyUrl: t.spotify_url,
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
      setErrorText(err?.message ?? '不明なエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  const displayedTracks: PlaylistRow[] =
    result?.tracks
      ? onlyUnowned
        ? result.tracks.filter((t) => t.owned === false)
        : result.tracks
      : [];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">
            Spotify Playlist Shopper
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Spotify プレイリストの URL と Rekordbox ライブラリ XML
            を指定して、「持ってる / 持ってない」を判定しつつ、
            Beatport / Bandcamp / iTunes 検索リンクを一覧生成します。
          </p>
        </header>

        {/* フォーム */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-xl p-6 space-y-4">
          <form onSubmit={handleAnalyze} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Spotify プレイリスト URL または ID
              </label>
              <input
                type="text"
                value={playlistUrl}
                onChange={handlePlaylistChange}
                className="w-full rounded-md border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="https://open.spotify.com/playlist/..."
              />
              <p className="text-xs text-slate-400">
                フル URL でも、プレイリスト ID だけでも OK です。
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Rekordbox Collection XML（任意）
              </label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <input
                  type="file"
                  accept=".xml"
                  onChange={handleRekordboxChange}
                  className="text-xs"
                />
                <span className="text-xs text-slate-400">
                  指定した XML 内の楽曲と突き合わせて「持ってる /
                  持ってない」を判定します。未選択の場合はプレイリストだけ取得します。
                </span>
              </div>
              {rekordboxFile && (
                <p className="text-xs text-emerald-300">
                  選択中: {rekordboxFile.name}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={onlyUnowned}
                  onChange={(e) => setOnlyUnowned(e.target.checked)}
                />
                未所持トラックのみ表示
              </label>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-black hover:bg-emerald-400 disabled:opacity-60"
              >
                {loading ? '解析中…' : '解析する'}
              </button>
            </div>
          </form>

          {errorText && (
            <div className="mt-4 rounded-md border border-red-500/60 bg-red-900/30 px-3 py-2 text-xs whitespace-pre-wrap">
              {errorText}
            </div>
          )}
        </section>

        {/* 結果 */}
        {result && (
          <section className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
              <div className="space-y-1">
                <div className="text-sm text-slate-400">
                  {result.total} 曲中 / 取得 {result.total} 曲 /{' '}
                  表示 {displayedTracks.length} 曲
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

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/70">
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
                    let ownedLabel = '–';
                    if (t.owned === true) ownedLabel = '●';
                    else if (t.owned === false) ownedLabel = '○';

                    return (
                      <tr
                        key={`${t.spotifyUrl}-${t.index}-${t.isrc ?? ''}`}
                        className="border-b border-slate-800/70 hover:bg-slate-800/40"
                      >
                        <td className="px-3 py-1 text-slate-400">
                          {t.index}
                        </td>
                        <td className="px-3 py-1">
                          <a
                            href={t.spotifyUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-200 hover:underline"
                          >
                            {t.title}
                          </a>
                        </td>
                        <td className="px-3 py-1 text-slate-200">
                          {t.artist}
                        </td>
                        <td className="px-3 py-1 text-slate-300">
                          {t.album}
                        </td>
                        <td className="px-3 py-1 text-slate-400">
                          {t.isrc ?? ''}
                        </td>
                        <td className="px-3 py-1 text-center">
                          {ownedLabel}
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
