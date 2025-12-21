import React from 'react';
import type { PlaylistRow, TrackCategory, ResultState } from '../../lib/types';

export type TrackTableProps = {
  currentResult: ResultState;
  tracks: PlaylistRow[];
  categoryLabels: Record<'all' | TrackCategory, string>;
  categorizeTrack: (t: PlaylistRow) => TrackCategory;
  openStoreDropdown: string | null;
  setOpenStoreDropdown: (val: string | null) => void;
  getOwnedStatusStyle: (
    owned: boolean | null | undefined,
    ownedReason: string | null | undefined
  ) => { borderClass: string; tooltip: string };
  getRecommendedStore: (track: PlaylistRow) => { name: string; url: string } | null;
  getOtherStores: (stores: PlaylistRow['stores'], recommended: { name: string; url: string } | null) => Array<{ name: string; url: string }>;
};

export function TrackTable({
  currentResult,
  tracks,
  categoryLabels,
  categorizeTrack,
  openStoreDropdown,
  setOpenStoreDropdown,
  getOwnedStatusStyle,
  getRecommendedStore,
  getOtherStores,
}: TrackTableProps) {
  const safeTracks = Array.isArray(tracks) ? tracks : [];
  return (
    <>
      {/* Mobile: card list */}
      <div className="md:hidden space-y-2">
        {safeTracks.map((t) => {
          const isApplePlaylist = currentResult.playlistUrl?.includes('music.apple.com');
          const trackUrl = isApplePlaylist ? t.appleUrl || t.spotifyUrl || undefined : t.spotifyUrl || t.appleUrl || undefined;
          const ownedStyle = getOwnedStatusStyle(t.owned, t.ownedReason);
          return (
            <div
              key={`${trackUrl ?? ''}-${t.index}-${t.isrc ?? ''}`}
              className={`rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-xs ${ownedStyle.borderClass}`}
              title={ownedStyle.tooltip}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <a
                      href={trackUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-slate-100 truncate hover:underline"
                    >
                      {t.title}
                    </a>
                  </div>
                  <div className="text-slate-400 text-[11px] truncate">{t.artist}</div>
                  <div className="text-slate-500 text-[11px] truncate">{t.album}</div>
                  {t.isrc && <div className="text-slate-500 text-[10px]">ISRC: {t.isrc}</div>}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {(() => {
                  const recommended = getRecommendedStore(t);
                  const others = getOtherStores(t.stores, recommended);
                  if (!recommended) return null;
                  return (
                    <>
                      <a
                        href={recommended.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 transition"
                        title={`Open on ${recommended.name} (recommended)`}
                      >
                        <span className="text-[10px] font-medium text-emerald-300">🔗</span>
                        <span className="text-[10px] text-emerald-300">{recommended.name}</span>
                      </a>
                      {others.map((store) => (
                        <a
                          key={store.name}
                          href={store.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center rounded-full border border-slate-600 px-2 py-0.5 hover:bg-slate-700"
                        >
                          <span className="text-[10px]">{store.name}</span>
                        </a>
                      ))}
                    </>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block mt-4 rounded-xl border border-slate-800 bg-slate-950/40 overflow-hidden">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-xs table-fixed">
            <thead className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur border-b border-slate-800">
              <tr className="text-slate-200">
                <th className="px-3 py-2 text-left text-xs font-semibold whitespace-nowrap w-14">#</th>
                <th className="px-3 py-2 text-left text-xs font-semibold whitespace-nowrap w-[30%]">Title</th>
                <th className="px-3 py-2 text-left text-xs font-semibold whitespace-nowrap w-[20%]">Artist</th>
                <th className="px-3 py-2 text-left text-xs font-semibold whitespace-nowrap w-[20%]">Album</th>
                <th className="px-2 py-2 text-left text-xs font-semibold whitespace-nowrap w-[12%]">ISRC</th>
                <th className="px-3 py-2 text-left text-xs font-semibold whitespace-nowrap w-[18%]">Stores</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const sections: Array<{ id: TrackCategory; label: string; color: string; items: PlaylistRow[]; icon: string }> = [
                  { id: 'checkout', label: categoryLabels.checkout, color: 'text-amber-300', icon: '🛒', items: safeTracks.filter((t) => categorizeTrack(t) === 'checkout') },
                  { id: 'owned', label: categoryLabels.owned, color: 'text-emerald-300', icon: '✅', items: safeTracks.filter((t) => categorizeTrack(t) === 'owned') },
                ];

                return sections.flatMap((section) => {
                  if (section.items.length === 0) return [];
                  return [
                    (
                      <tr key={`section-${section.id}`} className="bg-slate-900/70">
                        <td colSpan={6} className={`px-3 py-2 text-left text-[11px] font-semibold ${section.color}`}>
                          {section.icon} {section.label} ({section.items.length})
                        </td>
                      </tr>
                    ),
                    ...section.items.map((t) => {
                      const isApplePlaylist = currentResult.playlistUrl?.includes('music.apple.com');
                      const trackUrl = isApplePlaylist ? t.appleUrl || t.spotifyUrl || undefined : t.spotifyUrl || t.appleUrl || undefined;
                      const ownedStyle = getOwnedStatusStyle(t.owned, t.ownedReason);
                      const recommended = getRecommendedStore(t);
                      const others = getOtherStores(t.stores, recommended);
                      const dropdownId = `${section.id}-${t.index}-stores`;
                      const isOpen = openStoreDropdown === dropdownId;
                      return (
                        <tr
                          key={`${section.id}-${trackUrl ?? ''}-${t.index}-${t.isrc ?? ''}`}
                          className="border-b border-slate-900/60 hover:bg-slate-800/40 transition-colors relative"
                        >
                          <td className="px-3 py-1 text-slate-400">{t.index}</td>
                          <td className="px-3 py-1 text-sm text-slate-100">
                            <a
                              href={trackUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="block max-w-full truncate hover:underline"
                              title={`${t.title}${ownedStyle.tooltip ? ` (${ownedStyle.tooltip})` : ''}`}
                            >
                              {t.title}
                            </a>
                          </td>
                          <td className="px-3 py-1 text-sm text-slate-300">{t.artist}</td>
                          <td className="px-3 py-1 text-sm text-slate-400">{t.album}</td>
                          <td className="px-2 py-1 text-[11px] text-slate-500 break-words">{t.isrc || ''}</td>
                          <td className="px-3 py-1 text-xs text-slate-300">
                            {recommended && (
                              <div className="flex items-center gap-1">
                                <a
                                  href={recommended.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 rounded-full border border-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-0.5 transition"
                                  title={`Open on ${recommended.name} (recommended)`}
                                >
                                  <span className="text-[10px] font-medium text-emerald-300">🔗</span>
                                  <span className="text-[10px] text-emerald-300">{recommended.name}</span>
                                </a>

                                {/* Dropdown for other stores */}
                                {others.length > 0 && (
                                  <div className="relative">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenStoreDropdown(isOpen ? null : dropdownId);
                                      }}
                                      className="inline-flex items-center rounded-full border border-slate-600 px-2 py-0.5 hover:bg-slate-700 transition text-[10px] text-slate-300"
                                      title="Other stores"
                                    >
                                      +{others.length}
                                    </button>
                                    {isOpen && (
                                      <div className="absolute right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-lg z-50 min-w-40">
                                        {others.map((store) => (
                                          <a
                                            key={store.name}
                                            href={store.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="block px-3 py-2 text-xs text-slate-200 hover:bg-slate-700 first:rounded-t-lg last:rounded-b-lg transition"
                                            onClick={() => setOpenStoreDropdown(null)}
                                          >
                                            {store.name}
                                          </a>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    }),
                  ];
                }).filter(Boolean);
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
