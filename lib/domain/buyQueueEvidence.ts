import { z } from "zod";
import { LibraryMatchSchema } from "../api/responseSchemas";
import { recordingKey } from "./recordingIdentity";
import type { PlaylistRow, ResultState } from "../types";
export type QueueContext = {
  checkedAt?: string;
  xmlFilename?: string;
  rulesVersion?: number;
  libraryFingerprint?: string;
};
const schema = z.object({
  owned: z.boolean().nullable(),
  ownedReason: z.string().nullable().optional(),
  libraryMatch: LibraryMatchSchema.nullable().optional(),
  reviewDecision: z
    .object({
      action: z.enum(["owned", "different_version"]),
      updatedAt: z.string(),
    })
    .optional(),
  checkedAt: z.string().optional(),
  xmlFilename: z.string().optional(),
  rulesVersion: z.number().optional(),
  libraryFingerprint: z.string().optional(),
});
export type QueueEvidence = z.infer<typeof schema>;
export function parseQueueEvidence(value: unknown): QueueEvidence | undefined {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
export function captureQueueEvidence(
  track: PlaylistRow,
  context?: QueueContext,
): QueueEvidence | undefined {
  if (!context?.checkedAt || !context.libraryFingerprint) return undefined;
  return parseQueueEvidence({
    ...context,
    owned: track.owned ?? null,
    ownedReason: track.ownedReason,
    libraryMatch: track.libraryMatch,
    reviewDecision: track.reviewDecision,
  });
}

/** Scan result history once, not once per saved track. */
export function latestQueueEvidence(
  results: Array<[string, ResultState]>,
  ids: Set<string>,
) {
  const current = new Map<string, QueueEvidence>();
  for (const [, result] of results) {
    const context = {
      checkedAt: result.meta?.rekordbox?.matched_at,
      xmlFilename: result.rekordboxMeta?.filename,
      rulesVersion: result.meta?.ownership_rules_version,
      libraryFingerprint: result.meta?.rekordbox?.library_sha256,
    };
    if (
      !context.checkedAt ||
      !context.libraryFingerprint ||
      !Number.isFinite(Date.parse(context.checkedAt))
    )
      continue;
    for (const track of result.tracks) {
      const key = recordingKey(track);
      if (!ids.has(key)) continue;
      const previous = current.get(key);
      if (
        previous &&
        Date.parse(previous.checkedAt!) >= Date.parse(context.checkedAt)
      )
        continue;
      const evidence = captureQueueEvidence(track, context);
      if (evidence) current.set(key, evidence);
    }
  }
  return current;
}
