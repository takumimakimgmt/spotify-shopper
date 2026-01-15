import React, { useEffect, useRef } from "react";

interface AddPlaylistPanelProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function AddPlaylistPanel({
  value,
  onChange,
  onSubmit,
  onCancel,
}: AddPlaylistPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  return (
    <div className="flex flex-col gap-2 p-4 bg-slate-800 rounded-lg mt-4">
      <input
        ref={inputRef}
        type="text"
        className="px-3 py-2 rounded border border-slate-600 bg-slate-900 text-slate-100"
        placeholder="Paste playlist URL..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
        }}
      />
      <div className="flex gap-2">
        <button
          className="px-3 py-1 rounded bg-emerald-600 text-white"
          onClick={onSubmit}
        >
          Add
        </button>
        <button
          className="px-3 py-1 rounded bg-slate-600 text-white"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
