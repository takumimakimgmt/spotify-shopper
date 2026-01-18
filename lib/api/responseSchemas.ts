import { z } from "zod";

// Minimal track shape (passthrough to avoid breaking UI on extra fields)
export const TrackModelSchema = z
  .object({
    title: z.string(),
    // allow either artists[] or legacy artist, but don't require either
    artists: z.array(z.string()).optional(),
    artist: z.string().optional(),
  })
  .passthrough();

export const PlaylistOkResponseSchema = z
  .object({
    ok: z.literal(true),
    tracks: z.array(TrackModelSchema),
    // meta is optional and passthrough (backend may evolve)
    meta: z.unknown().optional(),
  })
  .passthrough();

export const PlaylistErrorResponseSchema = z
  .object({
    ok: z.literal(false),
    message: z.string().optional(),
    error: z.unknown().optional(),
  })
  .passthrough();

// Gate-1 / FE-1: API boundary schema
export const PlaylistResponseSchema = z.discriminatedUnion("ok", [
  PlaylistOkResponseSchema,
  PlaylistErrorResponseSchema,
]);

export type PlaylistResponseParsed = z.infer<typeof PlaylistResponseSchema>;
