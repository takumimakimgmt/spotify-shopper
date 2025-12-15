'use client';

import React from 'react';

export interface ProgressItem {
  url: string;
  status: 'pending' | 'fetching' | 'parsing' | 'done' | 'error';
  trackCount?: number;
  errorMessage?: string;
}

export interface ProgressListProps {
  items: ProgressItem[];
  visible?: boolean;
}

export default function ProgressList({ items, visible = true }: ProgressListProps) {
  if (!visible || items.length === 0) {
    return null;
  }

  const getStatusIcon = (status: ProgressItem['status']) => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'fetching':
        return '📡';
      case 'parsing':
        return '⚙️';
      case 'done':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '—';
    }
  };

  const getStatusColor = (status: ProgressItem['status']) => {
    switch (status) {
      case 'done':
        return 'text-emerald-400';
      case 'error':
        return 'text-red-400';
      case 'pending':
        return 'text-slate-400';
      default:
        return 'text-blue-400';
    }
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
      {items.map((item, idx) => (
        <div key={`${idx}-${item.url}`} className="flex items-center gap-2 text-xs">
          <span className={`${getStatusColor(item.status)} flex-shrink-0`}>
            {getStatusIcon(item.status)}
          </span>
          <span className="text-slate-400 truncate flex-1">
            {item.url.substring(0, 70)}...
          </span>
          {item.status === 'done' && item.trackCount !== undefined && (
            <span className="text-slate-400 flex-shrink-0">
              {item.trackCount} tracks
            </span>
          )}
          {item.status === 'error' && item.errorMessage && (
            <span className="text-red-400 flex-shrink-0" title={item.errorMessage}>
              Error
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
