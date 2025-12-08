"use client";

import { useState, ChangeEvent, FormEvent } from "react";

type Track = {
  title: string;
  artist: string;
  album: string;
  isrc?: string | null;
  spotify_url: string;
  links: {
    beatport: string;
    bandcamp: string;
    itunes: string;
  };
  owned?: boolean;
};

type PlaylistResponse = {
  playlist_id: string;
  playlist_name: string;
  playlist_url: string;
  tracks: Track[];
};

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:8000";

export default function HomePage() {
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [rekordboxFile, setRekordboxFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlaylistResponse | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setRekordboxFile(file);
  };

  const handleAnalyze = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!spotifyUrl.trim()) {
      setError("SpotifyプレイリストURLを入力してください。");
      return;
    }

    setLoading(true);
    try {
      let res: Response;

      if (rekordboxFile) {
        // XMLアップロード付き
        const formData = new FormData();
        formData.append("url", spotifyUrl.trim());
        formData.append("rekordbox_xml", rekordboxFile);

        res = await fetch(
          `${BACKEND_URL}/api/playlist-with-rekordbox-upload`,
          {
            method: "POST",
            body: formData,
          }
        );
      } else {
        // プレイリストだけ
        const urlParam = encodeURIComponent(spotifyUrl.trim());
        res = await fetch(`${BACKEND_URL}/api/playlist?url=${urlParam}`);
      }

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail ?? `Request failed: ${res.status}`);
      }

      const json = (await res.json()) as PlaylistResponse;
      setResult(json);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-5xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Spotify Playlist Shopper
          </h1>
          <p className="text-sm text-slate-400">
            SpotifyプレイリストのURLとRekordboxライブラリXMLを指定して、
            「持ってる / 持ってない」判定と、各ストア検索リンクを一覧生成します。
          </p>
        </header>

        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <form className="space-y-4" onSubmit={handleAnalyze}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                SpotifyプレイリストURL
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="https://open.spotify.com/playlist/..."
                value={spotifyUrl}
                onChange={(e) => setSpotifyUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Rekordbox XMLファイル（任意）
              </label>
              <input
                type="file"
                accept=".xml,text/xml"
                onChange={handleFileChange}
                className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-md file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-emerald-500"
              />
              <p className="text-xs text-slate-500">
                未選択なら「持ってる / 持ってない」判定なしでプレイリストだけ取得します。
              </p>
              {rekordboxFile && (
                <p className="text-xs text-emerald-400">
                  選択中: {rekordboxFile.name}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {loading ? "解析中..." : "解析する"}
            </button>
          </form>

          {error && (
            <div className="rounded-lg border border-red-500/60 bg-red-500/10 px-3 py-2 text-xs text-red-100">
              {error}
            </div>
          )}
        </section>

        {result && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold">{result.playlist_name}</h2>
                {result.playlist_url && (
                  <a
                    href={result.playlist_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-emerald-400 hover:underline"
                  >
                    Open in Spotify
                  </a>
                )}
              </div>
              <div className="text-xs text-slate-400">
                {result.tracks.length} tracks
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-2 text-left w-10">#</th>
                    <th className="px-4 py-2 text-left">Title</th>
                    <th className="px-4 py-2 text-left">Artist</th>
                    <th className="px-4 py-2 text-left">Album</th>
                    <th className="px-4 py-2 text-center w-20">Owned</th>
                    <th className="px-4 py-2 text-center w-40">Stores</th>
                  </tr>
                </thead>
                <tbody>
                  {result.tracks.map((track, idx) => (
                    <tr
                      key={`${track.spotify_url}-${idx}`}
                      className={
                        idx % 2 === 0
                          ? "bg-slate-900/40"
                          : "bg-slate-900/10"
                      }
                    >
                      <td className="px-4 py-2 text-xs text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-col">
                          <a
                            href={track.spotify_url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-slate-100 hover:underline"
                          >
                            {track.title}
                          </a>
                          {track.isrc && (
                            <span className="text-[11px] text-slate-500">
                              ISRC: {track.isrc}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-slate-200">
                        {track.artist}
                      </td>
                      <td className="px-4 py-2 text-slate-300">
                        {track.album}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {typeof track.owned === "boolean" ? (
                          track.owned ? (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-emerald-950">
                              ✓
                            </span>
                          ) : (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-600 text-[11px] text-slate-400">
                              -
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-slate-500">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-center gap-2">
                          <a
                            href={track.links.beatport}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-100 hover:bg-slate-700"
                          >
                            Beatport
                          </a>
                          <a
                            href={track.links.bandcamp}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-100 hover:bg-slate-700"
                          >
                            Bandcamp
                          </a>
                          <a
                            href={track.links.itunes}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-100 hover:bg-slate-700"
                          >
                            iTunes
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
