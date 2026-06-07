import type { PlaylistRow } from "../types";

export type TrackKeyType = "isrc" | "norm";

export type CanonicalTrackIdentity = {
  primary: {
    type: TrackKeyType;
    value: string;
    version: string;
  };
  fallback?: {
    type: "norm";
    value: string;
    version: string;
  };
};

export type OwnershipState = "owned" | "not_owned" | "unknown";

export type MatchMethod =
  | "isrc"
  | "exact"
  | "album"
  | "fuzzy"
  | "canonical"
  | "guess"
  | "none"
  | "unknown";

export type MatchConfidence = "high" | "medium" | "low" | "unknown";

export type MatchEvidenceSource =
  | "api"
  | "rekordbox_rematch"
  | "frontend_canonical_lookup"
  | "user_correction"
  | "unknown";

export type MatchEvidence = {
  method: MatchMethod;
  confidence: MatchConfidence;
  source: MatchEvidenceSource;
  rawReason?: string | null;
};

export type CorrectionEvent = {
  track: CanonicalTrackIdentity;
  action: "set_owned" | "set_not_owned" | "clear_override";
  previousOwnership: OwnershipState;
  previousEvidence?: MatchEvidence;
  createdAtISO: string;
};

export type EffectiveOwnership = {
  state: OwnershipState;
  identity: CanonicalTrackIdentity;
  evidence: MatchEvidence;
  correction?: CorrectionEvent;
  source: MatchEvidenceSource;
};

export type CurrentTrackOwnershipFields = Pick<
  PlaylistRow,
  | "owned"
  | "ownedReason"
  | "trackKeyPrimary"
  | "trackKeyFallback"
  | "trackKeyPrimaryType"
> & {
  ownedSource?: unknown;
  trackKeyVersion?: unknown;
};

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isMatchEvidenceSource(value: unknown): value is MatchEvidenceSource {
  return (
    value === "api" ||
    value === "rekordbox_rematch" ||
    value === "frontend_canonical_lookup" ||
    value === "user_correction" ||
    value === "unknown"
  );
}

function normalizeSource(value: unknown): MatchEvidenceSource {
  return isMatchEvidenceSource(value) ? value : "unknown";
}

function classifyReason(reason: string | null): {
  method: MatchMethod;
  confidence: MatchConfidence;
} {
  if (reason === "isrc" || reason === "exact") {
    return { method: reason, confidence: "high" };
  }
  if (reason === "album") {
    return { method: "album", confidence: "medium" };
  }
  if (reason === "fuzzy") {
    return { method: "fuzzy", confidence: "low" };
  }
  if (reason?.includes("canonical")) {
    return { method: "canonical", confidence: "unknown" };
  }
  if (reason?.includes("guess")) {
    return { method: "guess", confidence: "low" };
  }
  return { method: "unknown", confidence: "unknown" };
}

export function toCanonicalTrackIdentity(
  track: CurrentTrackOwnershipFields,
): CanonicalTrackIdentity | null {
  const primaryValue = asNonEmptyString(track.trackKeyPrimary);
  if (!primaryValue) return null;

  const version = asNonEmptyString(track.trackKeyVersion) ?? "v1";
  const identity: CanonicalTrackIdentity = {
    primary: {
      type: track.trackKeyPrimaryType === "isrc" ? "isrc" : "norm",
      value: primaryValue,
      version,
    },
  };

  const fallbackValue = asNonEmptyString(track.trackKeyFallback);
  if (fallbackValue) {
    identity.fallback = {
      type: "norm",
      value: fallbackValue,
      version,
    };
  }

  return identity;
}

export function toOwnershipState(
  owned: boolean | null | undefined,
): OwnershipState {
  if (owned === true) return "owned";
  if (owned === false) return "not_owned";
  return "unknown";
}

export function toMatchEvidence(input: {
  ownedReason: string | null | undefined;
  owned: boolean | null | undefined;
  source?: MatchEvidenceSource;
}): MatchEvidence {
  const rawReason = asNonEmptyString(input.ownedReason);
  const source = normalizeSource(input.source);

  if (!rawReason && input.owned === false) {
    return {
      method: "none",
      confidence: "unknown",
      source,
      rawReason: input.ownedReason ?? null,
    };
  }

  const classified = classifyReason(rawReason);
  return {
    ...classified,
    source,
    rawReason: input.ownedReason ?? null,
  };
}

export function toEffectiveOwnership(input: {
  track: CurrentTrackOwnershipFields;
  correction?: CorrectionEvent;
  source?: MatchEvidenceSource;
}): EffectiveOwnership | null {
  const identity = toCanonicalTrackIdentity(input.track);
  if (!identity) return null;

  const source = normalizeSource(input.source ?? input.track.ownedSource);
  const state = toOwnershipState(input.track.owned);
  const evidence = toMatchEvidence({
    owned: input.track.owned,
    ownedReason: input.track.ownedReason,
    source,
  });

  if (!input.correction || input.correction.action === "clear_override") {
    return {
      state,
      identity,
      evidence,
      correction: input.correction,
      source,
    };
  }

  return {
    state: input.correction.action === "set_owned" ? "owned" : "not_owned",
    identity,
    evidence: input.correction.previousEvidence ?? evidence,
    correction: input.correction,
    source: "user_correction",
  };
}

export function createCorrectionEvent(input: {
  track: CurrentTrackOwnershipFields;
  action: CorrectionEvent["action"];
  createdAtISO: string;
}): CorrectionEvent | null {
  const identity = toCanonicalTrackIdentity(input.track);
  if (!identity) return null;

  return {
    track: identity,
    action: input.action,
    previousOwnership: toOwnershipState(input.track.owned),
    previousEvidence: toMatchEvidence({
      owned: input.track.owned,
      ownedReason: input.track.ownedReason,
      source: normalizeSource(input.track.ownedSource),
    }),
    createdAtISO: input.createdAtISO,
  };
}
