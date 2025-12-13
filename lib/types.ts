export type StoreLinks = {
  beatport?: string;
  bandcamp?: string;
  itunes?: string;
  spotify?: string;
  apple?: string;
};

export type PlaylistSnapshotV1 = {
  schema: "playlist_snapshot";
  version: 1;
  created_at: string; // ISO
  playlist: {
    source: "spotify" | "apple";
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
