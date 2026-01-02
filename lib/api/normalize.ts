import type { PlaylistRow } from "../types";
import type { PlaylistResponse as ApiPlaylistResponse } from "./schema";

function stripNullsDeep(input: unknown): unknown {
  if (input === null || input === undefined) return undefined;
  if (Array.isArray(input)) return input.map(stripNullsDeep).filter((v) => v !== undefined);
  if (typeof input === "object") {
    const obj = input as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const vv = stripNullsDeep(v);
      if (vv !== undefined) out[k] = vv;
    }
    return out;
  }
  return input;
}


export function normalizeMeta(meta: ApiPlaylistResponse["meta"]): Record<string, unknown> | undefined {
  return stripNullsDeep(meta) as Record<string, unknown> | undefined;
}

export function normalizeTracks(json: ApiPlaylistResponse): PlaylistRow[] {
  return normalizeTracks(json);
}
