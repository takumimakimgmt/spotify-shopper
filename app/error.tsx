"use client";

import React, { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[GlobalError]", error);
  }, [error]);

  const clearLocal = () => {
    try {
      const EXACT_KEYS = [
        'spotify-shopper-results',
        'spotify-shopper-active-tab',
      ];
      for (const k of EXACT_KEYS) localStorage.removeItem(k);

      const PREFIXES = [
        "playlist-shopper",
        "spotify-shopper",
        "buylist",
        "share:",
      ];
      for (const k of Object.keys(localStorage)) {
        if (PREFIXES.some((p) => k.startsWith(p))) localStorage.removeItem(k);
      }
    } catch {}
  };

  return (
    <html>
      <body>
        <div style={{ maxWidth: 720, margin: "40px auto", padding: 16, fontFamily: "ui-sans-serif, system-ui" }}>
          <h1 style={{ fontSize: 18, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ opacity: 0.75, marginBottom: 16 }}>
            If this keeps happening, try resetting local data and reload.
          </p>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              onClick={() => reset()}
              style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #333" }}
            >
              Retry
            </button>

            <button
              onClick={() => {
                clearLocal();
                reset();
              }}
              style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #333" }}
            >
              Reset local data & Retry
            </button>

            <button
              onClick={() => {
                clearLocal();
                location.href = "/";
              }}
              style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #333" }}
            >
              Reset & Go Home
            </button>
          </div>

          <details style={{ marginTop: 16 }}>
            <summary style={{ cursor: "pointer" }}>Error details</summary>
            <pre style={{ whiteSpace: "pre-wrap", marginTop: 8, opacity: 0.75 }}>
{String(error?.message ?? error)}
{error?.digest ? `\n\ndigest: ${error.digest}` : ""}
            </pre>
          </details>
        </div>
      </body>
    </html>
  );
}
