import { describe, expect, test } from "vitest";
import {
  createCorrectionEvent,
  toCanonicalTrackIdentity,
  toEffectiveOwnership,
  toMatchEvidence,
  toOwnershipState,
  type CurrentTrackOwnershipFields,
} from "../lib/domain/ownership";

const baseTrack: CurrentTrackOwnershipFields = {
  owned: true,
  ownedReason: "isrc",
  trackKeyPrimary: "isrc:JP1234567890",
  trackKeyFallback: "norm:track a|artist a|album a",
  trackKeyPrimaryType: "isrc",
};

describe("ownership domain adapters", () => {
  test("maps canonical identity from current track fields", () => {
    expect(
      toCanonicalTrackIdentity({
        ...baseTrack,
        trackKeyVersion: "v2",
      }),
    ).toEqual({
      primary: {
        type: "isrc",
        value: "isrc:JP1234567890",
        version: "v2",
      },
      fallback: {
        type: "norm",
        value: "norm:track a|artist a|album a",
        version: "v2",
      },
    });
  });

  test("returns null when primary identity is missing", () => {
    expect(
      toCanonicalTrackIdentity({
        ...baseTrack,
        trackKeyPrimary: undefined,
      }),
    ).toBeNull();
    expect(
      toCanonicalTrackIdentity({
        ...baseTrack,
        trackKeyPrimary: "   ",
      }),
    ).toBeNull();
  });

  test("defaults canonical identity type and version conservatively", () => {
    expect(
      toCanonicalTrackIdentity({
        ...baseTrack,
        trackKeyPrimary: "norm:track a|artist a|album a",
        trackKeyFallback: undefined,
        trackKeyPrimaryType: undefined,
      }),
    ).toEqual({
      primary: {
        type: "norm",
        value: "norm:track a|artist a|album a",
        version: "v1",
      },
    });
  });

  test("maps ownership from current normalized frontend booleans", () => {
    expect(toOwnershipState(true)).toBe("owned");
    expect(toOwnershipState(false)).toBe("not_owned");
    expect(toOwnershipState(null)).toBe("unknown");
    expect(toOwnershipState(undefined)).toBe("unknown");
  });

  test("maps known match reasons to confidence levels", () => {
    expect(
      toMatchEvidence({
        owned: true,
        ownedReason: "exact",
        source: "api",
      }),
    ).toEqual({
      method: "exact",
      confidence: "high",
      source: "api",
      rawReason: "exact",
    });
    expect(
      toMatchEvidence({
        owned: true,
        ownedReason: "album",
        source: "rekordbox_rematch",
      }),
    ).toEqual({
      method: "album",
      confidence: "medium",
      source: "rekordbox_rematch",
      rawReason: "album",
    });
    expect(
      toMatchEvidence({
        owned: true,
        ownedReason: "fuzzy",
      }),
    ).toEqual({
      method: "fuzzy",
      confidence: "low",
      source: "unknown",
      rawReason: "fuzzy",
    });
  });

  test("preserves raw reasons for canonical, guess, and unknown evidence", () => {
    expect(
      toMatchEvidence({
        owned: true,
        ownedReason: "isrc (canonical match)",
        source: "frontend_canonical_lookup",
      }),
    ).toEqual({
      method: "canonical",
      confidence: "unknown",
      source: "frontend_canonical_lookup",
      rawReason: "isrc (canonical match)",
    });
    expect(
      toMatchEvidence({
        owned: true,
        ownedReason: "guess",
      }),
    ).toEqual({
      method: "guess",
      confidence: "low",
      source: "unknown",
      rawReason: "guess",
    });
    expect(
      toMatchEvidence({
        owned: true,
        ownedReason: "future-backend-reason",
      }),
    ).toEqual({
      method: "unknown",
      confidence: "unknown",
      source: "unknown",
      rawReason: "future-backend-reason",
    });
  });

  test("maps absent evidence on not-owned rows to none", () => {
    expect(
      toMatchEvidence({
        owned: false,
        ownedReason: null,
        source: "api",
      }),
    ).toEqual({
      method: "none",
      confidence: "unknown",
      source: "api",
      rawReason: null,
    });
  });

  test("builds effective ownership without applying corrections", () => {
    expect(
      toEffectiveOwnership({
        track: {
          ...baseTrack,
          ownedSource: "rekordbox_rematch",
        },
      }),
    ).toEqual({
      state: "owned",
      identity: {
        primary: {
          type: "isrc",
          value: "isrc:JP1234567890",
          version: "v1",
        },
        fallback: {
          type: "norm",
          value: "norm:track a|artist a|album a",
          version: "v1",
        },
      },
      evidence: {
        method: "isrc",
        confidence: "high",
        source: "rekordbox_rematch",
        rawReason: "isrc",
      },
      source: "rekordbox_rematch",
    });
  });

  test("applies correction as an overlay without rewriting previous evidence", () => {
    const correction = createCorrectionEvent({
      track: baseTrack,
      action: "set_not_owned",
      createdAtISO: "2026-05-26T00:00:00.000Z",
    });

    expect(correction).toEqual({
      track: {
        primary: {
          type: "isrc",
          value: "isrc:JP1234567890",
          version: "v1",
        },
        fallback: {
          type: "norm",
          value: "norm:track a|artist a|album a",
          version: "v1",
        },
      },
      action: "set_not_owned",
      previousOwnership: "owned",
      previousEvidence: {
        method: "isrc",
        confidence: "high",
        source: "unknown",
        rawReason: "isrc",
      },
      createdAtISO: "2026-05-26T00:00:00.000Z",
    });

    expect(
      toEffectiveOwnership({
        track: baseTrack,
        correction: correction ?? undefined,
        source: "api",
      }),
    ).toEqual({
      state: "not_owned",
      identity: {
        primary: {
          type: "isrc",
          value: "isrc:JP1234567890",
          version: "v1",
        },
        fallback: {
          type: "norm",
          value: "norm:track a|artist a|album a",
          version: "v1",
        },
      },
      evidence: {
        method: "isrc",
        confidence: "high",
        source: "unknown",
        rawReason: "isrc",
      },
      correction,
      source: "user_correction",
    });
  });
});
