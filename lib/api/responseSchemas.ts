import { z } from "zod";

const StoreLinksModelSchema = z
  .object({
    beatport: z.string().nullable().optional(),
    bandcamp: z.string().nullable().optional(),
    itunes: z.string().nullable().optional(),
  })
  .passthrough();

export const TrackModelSchema = z
  .object({
    title: z.string(),
    artist: z.string(),
    album: z.string().nullable().optional(),
    isrc: z.string().nullable().optional(),
    spotify_url: z.string().nullable().optional(),
    apple_url: z.string().nullable().optional(),
    links: StoreLinksModelSchema.nullable().optional(),
    owned: z.boolean().nullable().optional(),
    owned_reason: z.string().nullable().optional(),
    track_key_primary: z.string().nullable().optional(),
    track_key_fallback: z.string().nullable().optional(),
    track_key_primary_type: z.enum(["isrc", "norm"]).default("norm"),
    track_key_version: z.string().default("v1"),
  })
  .passthrough();

export const PlaylistResponseSchema = z
  .object({
    playlist_id: z.string(),
    playlist_name: z.string(),
    playlist_url: z.string().nullable().optional(),
    tracks: z.array(TrackModelSchema),
    meta: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .passthrough();

export type PlaylistResponseParsed = z.infer<typeof PlaylistResponseSchema>;
