"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import { STORAGE_KEYS } from "../storage/keys";
import { recordingKey } from "../domain/recordingIdentity";
import type { PlaylistRow } from "../types";

const DecisionSchema = z.object({
  action: z.enum(["owned", "different_version"]),
  updatedAt: z.string(),
  libraryFingerprint: z.string().optional(),
  candidate: z.string().optional(),
  rulesVersion: z.number().optional(),
});
const StoreSchema = z.object({
  version: z.literal(1),
  decisions: z.record(z.string(), DecisionSchema),
});
export type ReviewDecision = z.infer<typeof DecisionSchema>;
export type ReviewDecisions = Record<string, ReviewDecision>;

export function applyReviewDecisions(
  tracks: PlaylistRow[],
  decisions: ReviewDecisions,
  fingerprint?: string,
  rulesVersion?: number,
): PlaylistRow[] {
  return tracks.map((track) => {
    const decision = decisions[recordingKey(track)];
    const applicable =
      decision &&
      (decision.action === "owned" ||
        (!!fingerprint &&
          decision.libraryFingerprint === fingerprint &&
          decision.candidate === candidateKey(track) &&
          decision.rulesVersion === rulesVersion));
    return { ...track, reviewDecision: applicable ? decision : undefined };
  });
}

export function useReviewDecisions() {
  const [decisions, setDecisions] = useState<ReviewDecisions>({});
  const [warning, setWarning] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const restore = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.reviewDecisions);
        setDecisions(
          raw === null ? {} : StoreSchema.parse(JSON.parse(raw)).decisions,
        );
        setReady(true);
        setWarning(null);
      } catch {
        setReady(false);
        setWarning(
          "Saved confirmations could not be read. Existing data has been kept; confirmations are read-only until storage is repaired.",
        );
      }
    };
    restore();
    const changed = (event: StorageEvent) => {
      if (event.key === STORAGE_KEYS.reviewDecisions || event.key === null)
        restore();
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  const decide = (
    track: PlaylistRow,
    action: ReviewDecision["action"] | null,
    fingerprint?: string,
    rulesVersion?: number,
  ) => {
    if (!ready) return;
    try {
      // Read the latest saved map for each user action; never write from a stale render effect.
      const raw = localStorage.getItem(STORAGE_KEYS.reviewDecisions);
      const next =
        raw === null ? {} : StoreSchema.parse(JSON.parse(raw)).decisions;
      const key = recordingKey(track);
      if (action === null) delete next[key];
      else {
        if (action === "different_version" && !fingerprint)
          throw new Error("Recheck XML before confirming a different version.");
        next[key] = {
          action,
          updatedAt: new Date().toISOString(),
          libraryFingerprint: fingerprint,
          candidate: candidateKey(track),
          rulesVersion,
        };
      }
      localStorage.setItem(
        STORAGE_KEYS.reviewDecisions,
        JSON.stringify({ version: 1, decisions: next }),
      );
      setDecisions(next);
      setWarning(null);
    } catch {
      setWarning(
        "Confirmation could not be saved. Existing saved confirmations have been kept.",
      );
    }
  };
  const clearAll = () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.reviewDecisions);
      setDecisions({});
      setReady(true);
      setWarning(null);
    } catch {
      setWarning("Saved confirmations could not be removed.");
    }
  };
  return { decisions, decide, clearAll, warning, ready };
}

function candidateKey(track: PlaylistRow): string {
  return JSON.stringify([
    track.libraryMatch?.matched_title || "",
    track.libraryMatch?.matched_artist || "",
    track.libraryMatch?.reason || track.ownedReason || "",
  ]);
}
