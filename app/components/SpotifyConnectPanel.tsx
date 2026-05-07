"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  beginSpotifyLogin,
  completeSpotifyLoginFromUrl,
  fetchCurrentUserPlaylists,
  getSpotifyAuthScopes,
  getSpotifySession,
  isSpotifyAuthConfigured,
  logoutSpotify,
  type SpotifyPlaylistSummary,
} from "@/lib/spotify/client";

type SpotifyConnectPanelProps = {
  playlistUrlInput: string;
  setPlaylistUrlInput: (value: string) => void;
};

export default function SpotifyConnectPanel(props: SpotifyConnectPanelProps) {
  const { playlistUrlInput, setPlaylistUrlInput } = props;
  const [isConfigured] = useState(() => isSpotifyAuthConfigured());
  const [isConnected, setIsConnected] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<SpotifyPlaylistSummary[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!isConfigured) return;
      try {
        if (window.location.search.includes("code=")) {
          setLoadingAuth(true);
          await completeSpotifyLoginFromUrl(window.location.href);
        }

        const session = await getSpotifySession();
        if (cancelled) return;
        if (!session) {
          setIsConnected(false);
          return;
        }

        setIsConnected(true);
        setLoadingPlaylists(true);
        const nextPlaylists = await fetchCurrentUserPlaylists();
        if (cancelled) return;
        setPlaylists(nextPlaylists);
      } catch (error) {
        if (cancelled) return;
        setAuthError(
          error instanceof Error ? error.message : "Spotify connection failed.",
        );
        setIsConnected(false);
      } finally {
        if (!cancelled) {
          setLoadingAuth(false);
          setLoadingPlaylists(false);
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [isConfigured]);

  useEffect(() => {
    if (!playlists.length) return;
    const existing = playlists.find(
      (playlist) => playlist.url === playlistUrlInput,
    );
    if (existing) {
      setSelectedPlaylistId(existing.id);
      return;
    }
    if (!selectedPlaylistId) {
      setSelectedPlaylistId(playlists[0].id);
      if (!playlistUrlInput.trim()) {
        setPlaylistUrlInput(playlists[0].url);
      }
    }
  }, [playlistUrlInput, playlists, selectedPlaylistId, setPlaylistUrlInput]);

  const selectedPlaylist = useMemo(
    () =>
      playlists.find((playlist) => playlist.id === selectedPlaylistId) ?? null,
    [playlists, selectedPlaylistId],
  );

  const handleConnect = async () => {
    setAuthError(null);
    setLoadingAuth(true);
    try {
      await beginSpotifyLogin();
    } catch (error) {
      setLoadingAuth(false);
      setAuthError(
        error instanceof Error ? error.message : "Spotify connection failed.",
      );
    }
  };

  const handleSelect = (playlistId: string) => {
    setSelectedPlaylistId(playlistId);
    const playlist = playlists.find((item) => item.id === playlistId);
    if (playlist) {
      setPlaylistUrlInput(playlist.url);
    }
  };

  const handleDisconnect = () => {
    logoutSpotify();
    setIsConnected(false);
    setPlaylists([]);
    setSelectedPlaylistId("");
  };

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-emerald-100">
            Connect Spotify
          </div>
          <p className="text-sm text-emerald-50/80">
            Primary path: connect your account, pick one of your playlists, then
            optionally attach Rekordbox XML before analysis.
          </p>
        </div>
        {isConnected ? (
          <button
            type="button"
            onClick={handleDisconnect}
            className="rounded-md border border-emerald-200/30 px-3 py-2 text-sm text-emerald-100 hover:bg-emerald-400/10"
          >
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            onClick={handleConnect}
            disabled={!isConfigured || loadingAuth}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-50"
          >
            {loadingAuth ? "Connecting..." : "Connect Spotify"}
          </button>
        )}
      </div>

      {!isConfigured ? (
        <div className="rounded-md border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-100">
          Spotify login is not configured. Set `NEXT_PUBLIC_SPOTIFY_CLIENT_ID`
          and optionally `NEXT_PUBLIC_SPOTIFY_REDIRECT_URI`.
        </div>
      ) : null}

      {authError ? (
        <div className="rounded-md border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-100">
          {authError}
        </div>
      ) : null}

      <div className="text-xs text-emerald-50/70">
        Scopes: {getSpotifyAuthScopes().join(", ")}
      </div>

      {isConnected ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-emerald-50">
              Choose a Spotify playlist
            </label>
            <select
              value={selectedPlaylistId}
              onChange={(e) => handleSelect(e.target.value)}
              disabled={loadingPlaylists || playlists.length === 0}
              className="w-full rounded-md border border-emerald-200/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-50 outline-none"
            >
              {playlists.length === 0 ? (
                <option value="">
                  {loadingPlaylists
                    ? "Loading playlists..."
                    : "No playlists found"}
                </option>
              ) : null}
              {playlists.map((playlist) => (
                <option key={playlist.id} value={playlist.id}>
                  {playlist.name} · {playlist.trackCount} tracks
                </option>
              ))}
            </select>
          </div>

          {selectedPlaylist ? (
            <div className="rounded-md border border-emerald-200/20 bg-slate-950/40 p-3 text-xs text-emerald-50/80">
              <div>{selectedPlaylist.name}</div>
              <div className="mt-1">
                Owner: {selectedPlaylist.ownerName} ·{" "}
                {selectedPlaylist.trackCount} tracks
              </div>
              <div className="mt-1 break-all text-emerald-100/70">
                {selectedPlaylist.url}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="text-xs text-emerald-50/70">
          Or continue with the URL paste flow below.
        </div>
      )}
    </div>
  );
}
