import type { PlaylistResponse, TrackModel, StoreLinksModel } from "./api/schema";

/** API transport types are derived from OpenAPI (single source of truth). */
export type ApiStoreLinks = StoreLinksModel;
export type ApiTrack = TrackModel;
export type ApiPlaylistResponse = PlaylistResponse;

// --- RekordboxMeta for XML meta info ---

// 軽量保存用: tracksを除外したResultState
export type LightResult = Omit<ResultState, 'tracks'> & {
  tracks?: never;
};
export type RekordboxMeta = {
  filename: string;
  updatedAtISO: string; // new Date(file.lastModified).toISOString()
};
// Shared types used across the app (API responses, UI state)

export type StoreLinks = {
  beatport?: string;
  bandcamp?: string;
  itunes?: string;
  spotify?: string;
  apple?: string;
};


export type ApiMeta = {
  cache_hit?: boolean;
  cache_ttl_s?: number;
  refresh?: number;
  fetch_ms?: number;
  enrich_ms?: number;
  total_backend_ms?: number;
  total_api_ms?: number;
  apple_mode?: 'auto' | 'fast' | 'legacy';
  apple_legacy_used?: boolean;
  apple_strategy?: 'html';
  apple_enrich_skipped?: boolean;
  reason?: string;
  seen_catalog_playlist_api?: boolean;
  apple_api_candidates?: any[];
  apple_response_candidates?: any[];
  apple_request_candidates?: any[];
  apple_xhr_fetch_requests?: any[];
  json_responses_any_domain?: any[];
  apple_console_errors?: string[];
  apple_page_errors?: string[];
  apple_page_title?: string;
  apple_html_snippet?: string;
  blocked_hint?: boolean;
  // Client-side timings (measured in browser)
  client_total_ms?: number;
  client_api_ms?: number;
  client_map_ms?: number;
  client_overhead_ms?: number;
  payload_bytes?: number;
  rekordbox?: {
    track_total?: number;
    fuzzy_count?: number;
    match_ms?: number;
  };
};



export type PlaylistRow = {
  index: number;
  title: string;
  artist: string;
  album: string;
  label?: string | null;
  isrc?: string;
  spotifyUrl?: string;
  appleUrl?: string;
  stores: StoreLinks;
  owned?: boolean | null;
  ownedReason?: string | null;
  trackKeyPrimary?: string;
  trackKeyFallback?: string;
  trackKeyPrimaryType?: 'isrc' | 'norm';
  trackKeyGuess?: string;
};

export type ResultState = {
  title: string;
  total: number;
  playlistUrl: string;
  playlist_id?: string;
  playlist_name?: string;
  tracks: PlaylistRow[];
  analyzedAt: number;
  hasRekordboxData?: boolean;
  meta?: ApiMeta;
  rekordboxMeta?: RekordboxMeta | null;
  errorText?: string | null;
  errorMeta?: unknown;
};

export type SortKey = 'none' | 'artist' | 'album' | 'title';
export type TrackCategory = 'checkout' | 'owned';

export type PlaylistSnapshotV1 = {
  schema: "playlist_snapshot";
  version: 1;
  created_at: string; // ISO
  playlist: {
    source: "spotify";
    url: string;
    id?: string;
    name?: string;
    track_count: number;
  };
  tracks: Array<{
    title: string;
    artist: string;
    album?: string;
    isrc?: string | null;
    owned?: boolean;
    owned_reason?: string | null;
    track_key_primary: string;
    track_key_fallback: string;
    track_key_version: "v1";
    track_key_primary_type: "isrc" | "norm";
    links?: StoreLinks;
  }>;
};
