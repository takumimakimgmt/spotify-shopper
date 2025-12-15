'use client';

import React from 'react';

export interface ProgressItem {
  url: string;
  status: 'pending' | 'fetching' | 'parsing' | 'done' | 'error';
  message?: string;
}

export interface ProgressListProps {
  items: ProgressItem[];
  isProcessing: boolean;
}

const statusIcons: Record<string, string> = {
  pending: '⏳',
  fetching: '📡',
  parsing: '⚙️',
  done: '✅',
  error: '❌',
};

export default function ProgressList({ items, isProcessing }: ProgressListProps) {
  if (!isProcessing || items.length === 0) {
    return null;
  }

  const total = items.length;
  const completed = items.filter((i) => i.status === 'done' || i.status === 'error').length;

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400 font-medium">
        Processing ({completed}/{total})
      </p>
      <div className="space-y-1">
        {items.map((item, idx) => (
          <div
            key={`${item.url}-${idx}`}
            className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900/30 rounded px-3 py-2"
          >
            <span className="text-sm">{statusIcons[item.status] || '◯'}</span>
            <span className="flex-1 truncate font-mono">{item.url}</span>
            <span className="text-slate-500 text-xs whitespace-nowrap">
              {item.message || item.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
