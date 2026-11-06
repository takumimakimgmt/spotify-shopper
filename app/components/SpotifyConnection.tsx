"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";

export default function SpotifyConnection() {
  const { t } = useI18n();
  const [state, setState] = useState<{
    enabled: boolean;
    connected: boolean;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/spotify/session", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((value) => {
        if (
          value &&
          typeof value.enabled === "boolean" &&
          typeof value.connected === "boolean"
        )
          setState(value);
      })
      .catch(() => {});
    const url = new URL(window.location.href);
    const result = url.searchParams.get("spotify_auth");
    if (result) {
      setMessage(
        result === "connected"
          ? "Spotify connected."
          : result === "cancelled"
            ? "Spotify connection was cancelled."
            : "Could not connect Spotify. Try again or contact the site owner.",
      );
      url.searchParams.delete("spotify_auth");
      window.history.replaceState(
        null,
        "",
        url.pathname + url.search + url.hash,
      );
    }
    return () => controller.abort();
  }, []);
  if (!state?.enabled) return null;
  async function disconnect() {
    setBusy(true);
    try {
      const res = await fetch("/api/spotify/logout", { method: "POST" });
      if (!res.ok) throw new Error();
      setState({ enabled: true, connected: false });
      setMessage(
        "Spotify disconnected. Saved analyses remain on this browser.",
      );
    } catch {
      setMessage("Could not disconnect Spotify. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-label={t("Spotify connection")}
      className="my-5 rounded-lg border border-white/10 p-4 text-sm text-slate-300"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>
          {t(
            state.connected
              ? "Spotify connected."
              : "Connect Spotify to read playlists you own or collaborate on, including private playlists.",
          )}
        </p>
        {state.connected ? (
          <button
            type="button"
            disabled={busy}
            onClick={disconnect}
            className="min-h-10 rounded border border-white/20 px-3 disabled:opacity-50"
          >
            {t("Disconnect Spotify")}
          </button>
        ) : (
          <a
            href="/api/spotify/login"
            className="inline-flex min-h-10 items-center rounded border border-emerald-400/40 px-3 text-emerald-200"
          >
            {t("Connect Spotify")}
          </a>
        )}
      </div>
      {state.connected && (
        <a
          href="/api/spotify/login"
          className="mt-2 inline-block underline underline-offset-4"
        >
          {t("Reconnect Spotify")}
        </a>
      )}
      <p className="mt-2 text-xs text-slate-400">
        {t(
          "Limited beta: only accounts approved by the app owner can connect. Connecting does not grant access to every public playlist.",
        )}
      </p>
      {message && (
        <p role="status" className="mt-2">
          {t(message)}
        </p>
      )}
    </section>
  );
}
