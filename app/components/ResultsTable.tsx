"use client";
import React from "react";

export default function ResultsTable(props: any) {
  const currentResult = props?.currentResult ?? null;
  const displayedTracks = props?.displayedTracks;
  const safe = Array.isArray(displayedTracks) ? displayedTracks : [];
  if (!currentResult) return null;

  return (
    <div className="mt-4 space-y-2">
      <div className="md:hidden space-y-2">
        {safe.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-white/50 text-center">
            No tracks
          </div>
        ) : (
          safe.map((t, i) => (
            <div
              key={`${t?.isrc ?? ""}-${i}`}
              className="rounded-xl border border-white/10 bg-white/5 p-3"
            >
              <div className="text-sm font-medium text-white truncate">{t?.title ?? ""}</div>
              <div className="text-xs text-white/70 truncate">{t?.artist ?? ""}</div>
              <div className="text-xs text-white/50 truncate">{t?.album ?? ""}</div>
            </div>
          ))
        )}
      </div>

      <div className="hidden md:block rounded-2xl border border-white/10 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="px-3 py-2 text-left">Title</th>
              <th className="px-3 py-2 text-left">Artist</th>
              <th className="px-3 py-2 text-left">Album</th>
              <th className="px-3 py-2 text-left">ISRC</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {safe.map((t, i) => (
              <tr key={`${t?.isrc ?? ""}-${i}`} className="hover:bg-white/5">
                <td className="px-3 py-2 text-white">{t?.title ?? ""}</td>
                <td className="px-3 py-2 text-white/80">{t?.artist ?? ""}</td>
                <td className="px-3 py-2 text-white/60">{t?.album ?? ""}</td>
                <td className="px-3 py-2 text-white/40">{t?.isrc ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
