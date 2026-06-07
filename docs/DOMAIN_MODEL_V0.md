# Domain Model v0

This is an adapter-layer model for current Spotify Shopper ownership data.
It documents a safer vocabulary without changing backend contracts or runtime
behavior.

## Goals

- Keep canonical track identity separate from ownership state.
- Keep ownership state separate from match evidence.
- Make user corrections an explicit overlay, not a mutation of match evidence.
- Describe current frontend semantics honestly, especially around `owned: false`.

## Current Repo Inputs

Current frontend rows use `PlaylistRow` fields:

```ts
type CurrentTrackOwnershipFields = Pick<
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
```

API snake_case inputs currently map to these frontend fields:

- `owned` -> `owned`
- `owned_reason` -> `ownedReason`
- `track_key_primary` -> `trackKeyPrimary`
- `track_key_fallback` -> `trackKeyFallback`
- `track_key_primary_type` -> `trackKeyPrimaryType`
- `track_key_version` -> not retained on `PlaylistRow` today

Important: `OwnershipState` below is derived from the current normalized
frontend contract. Today, `owned: false` may include weaker semantics than a
strongly proven not-owned state because API `null`, missing, or unrecognized
ownership can be normalized to `false` before it reaches `PlaylistRow`.

## Minimal Types

```ts
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
```

## Pure Adapter Spec

These functions are pure and should have no storage, network, React, or backend
side effects.

```ts
export function toCanonicalTrackIdentity(
  track: CurrentTrackOwnershipFields,
): CanonicalTrackIdentity | null;

export function toOwnershipState(
  owned: boolean | null | undefined,
): OwnershipState;

export function toMatchEvidence(input: {
  ownedReason: string | null | undefined;
  owned: boolean | null | undefined;
  source?: MatchEvidenceSource;
}): MatchEvidence;

export function toEffectiveOwnership(input: {
  track: CurrentTrackOwnershipFields;
  correction?: CorrectionEvent;
  source?: MatchEvidenceSource;
}): EffectiveOwnership | null;

export function createCorrectionEvent(input: {
  track: CurrentTrackOwnershipFields;
  action: CorrectionEvent["action"];
  createdAtISO: string;
}): CorrectionEvent | null;
```

## Mapping Rules

### CanonicalTrackIdentity

- If `trackKeyPrimary` is absent or empty, return `null`.
- `trackKeyPrimary` maps to `primary.value`.
- `trackKeyPrimaryType === "isrc"` maps to `primary.type = "isrc"`.
- Any other current value maps to `primary.type = "norm"`.
- `trackKeyVersion` maps to `primary.version` if it is a string.
- Otherwise default `primary.version` to `"v1"`.
- If `trackKeyFallback` is present, map it to `fallback.value`.
- `fallback.type` is always `"norm"` in v0.
- `fallback.version` uses the same version as `primary.version`.

### OwnershipState

- `owned === true` maps to `"owned"`.
- `owned === false` maps to `"not_owned"` under the current frontend contract.
- `owned == null` maps to `"unknown"`.

Note: v0 does not claim that `"not_owned"` is a strong backend proof. It means
the current normalized frontend row is not owned. This may include weaker states
that were collapsed to `false` during normalization.

### MatchEvidence

- `ownedReason === "isrc"` maps to method `"isrc"`, confidence `"high"`.
- `ownedReason === "exact"` maps to method `"exact"`, confidence `"high"`.
- `ownedReason === "album"` maps to method `"album"`, confidence `"medium"`.
- `ownedReason === "fuzzy"` maps to method `"fuzzy"`, confidence `"low"`.
- Reason containing `"canonical"` maps to method `"canonical"`, confidence
  `"unknown"`, preserving `rawReason`.
- Reason containing `"guess"` maps to method `"guess"`, confidence `"low"`,
  preserving `rawReason`.
- Empty reason with `owned === false` maps to method `"none"`, confidence
  `"unknown"`.
- Empty reason with any other ownership maps to method `"unknown"`, confidence
  `"unknown"`.
- Unknown reason strings map to method `"unknown"`, confidence `"unknown"`,
  preserving `rawReason`.
- Missing `source` maps to `"unknown"`.

### CorrectionEvent

- If canonical identity cannot be produced, return `null`.
- A correction records a user action against the canonical identity.
- A correction must preserve previous ownership and previous evidence.
- A correction must not rewrite `ownedReason`.
- Persistence, precedence, and conflict handling are out of scope for v0.

### EffectiveOwnership

- If canonical identity cannot be produced, return `null`.
- Without a correction, use adapter-derived ownership and evidence.
- With `set_owned`, state becomes `"owned"` and source becomes
  `"user_correction"`.
- With `set_not_owned`, state becomes `"not_owned"` and source becomes
  `"user_correction"`.
- With `clear_override`, use adapter-derived ownership and evidence.
- Evidence remains separate from the final effective state.

## Explicit Unknowns

- Whether backend `owned_reason` is a closed vocabulary.
- Whether fuzzy evidence should ever count as final owned, maybe owned, or
  unknown.
- Backend confidence thresholds, if any.
- Whether `track_key_version` can differ from `"v1"`.
- Whether `ownedSource` is intended to be a durable frontend field.
- How user corrections should persist.
- How user corrections should resolve conflicts with future backend matches.
- Whether API `owned: null` has distinct backend meaning, because the current
  frontend normalization can collapse it to `false`.

## Types/Docs Only First

Safe first additions with no runtime behavior change:

- This document.
- A type-only module exporting the v0 domain types.
- Unit test fixtures documenting expected pure adapter behavior, without
  importing the adapter into UI selectors, table rendering, API normalization,
  or snapshot matching.

## Safest First Code Change

Add `lib/domain/ownership.ts` with only v0 types and pure adapter helpers, plus
focused tests. Do not wire it into runtime paths yet:

- Do not change API schemas.
- Do not change backend payloads.
- Do not change `normalizeTrack`.
- Do not change `categorizeTrack`.
- Do not change owned badges, filtering, counts, or buy queue behavior.
