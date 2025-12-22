"use client";
import React from "react";

export default function ErrorPage({ reset }: { reset: () => void }) {
  const handleClear = () => {
    localStorage.removeItem("playlist-shopper-results");
    localStorage.removeItem("playlist-shopper-selection");
    localStorage.removeItem("playlist-shopper-filters");
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100 p-8">
      <h1 className="text-2xl font-bold mb-4">Application error</h1>
      <p className="mb-6">A client-side exception occurred. This may be due to a schema change or corrupted local data.</p>
      <div className="flex gap-4">
        <button
          className="px-4 py-2 rounded bg-emerald-600 text-white font-semibold hover:bg-emerald-500"
          onClick={handleClear}
        >
          Reset local data
        </button>
        <button
          className="px-4 py-2 rounded bg-slate-700 text-white font-semibold hover:bg-slate-600"
          onClick={reset}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
