import { describe, expect, test } from "vitest";
import { z } from "zod";
import { normalizeApiError } from "@/lib/api/errors";

describe("normalizeApiError", () => {
  test("normal Error object", () => {
    expect(normalizeApiError(new Error("boom"))).toMatchObject({
      message: "Something went wrong. Please try again.",
      retryable: false,
    });
  });

  test("API error with status and data.detail", () => {
    expect(
      normalizeApiError({
        status: 400,
        data: {
          detail: {
            error: "url must be a Spotify playlist URL",
            used_source: "spotify",
          },
        },
      }),
    ).toMatchObject({
      message: "Enter a Spotify playlist URL, URI, or ID.",
      status: 400,
      detail: {
        error: "url must be a Spotify playlist URL",
        used_source: "spotify",
      },
      retryable: false,
    });
  });

  test("API error with requestId", () => {
    expect(
      normalizeApiError({
        status: 503,
        data: {
          error: "backend_unavailable",
          message: "upstream failed",
          requestId: "req_123",
        },
      }),
    ).toMatchObject({
      message: "Could not reach the analysis server. Please try again.",
      status: 503,
      code: "backend_unavailable",
      requestId: "req_123",
      retryable: true,
    });
  });

  test("AbortError / timeout", () => {
    expect(
      normalizeApiError(
        new DOMException("The operation timed out", "AbortError"),
      ),
    ).toMatchObject({
      message: "Analysis took too long. Please try again.",
      retryable: true,
    });
  });

  test("Zod validation error", () => {
    const parsed = z.object({ tracks: z.array(z.string()) }).safeParse({});
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    expect(normalizeApiError(parsed.error)).toMatchObject({
      message: "Something went wrong. Please try again.",
      detail: parsed.error.issues,
      retryable: false,
    });
  });

  test("unknown string", () => {
    expect(normalizeApiError("nope")).toMatchObject({
      message: "Something went wrong. Please try again.",
      retryable: false,
    });
  });

  test("unknown object", () => {
    expect(normalizeApiError({ what: "is this" })).toMatchObject({
      message: "Something went wrong. Please try again.",
      retryable: false,
    });
  });

  test("null and undefined", () => {
    expect(normalizeApiError(null)).toMatchObject({
      message: "Something went wrong. Please try again.",
      retryable: false,
    });
    expect(normalizeApiError(undefined)).toMatchObject({
      message: "Something went wrong. Please try again.",
      retryable: false,
    });
  });
});

test("distinguishes Spotify configuration, permission, expiry and rate limit failures", () => {
  const cases = [
    [400, "SPOTIFY_PLAYLIST_RESTRICTED", "editorial", false],
    [503, "SPOTIFY_AUTH_CONFIG", "not configured correctly", false],
    [401, "SPOTIFY_LOGIN_EXPIRED", "expired", false],
    [403, "SPOTIFY_ACCESS_RESTRICTED", "account is allowed", false],
    [404, "SPOTIFY_PLAYLIST_UNAVAILABLE", "permission", false],
    [429, "SPOTIFY_RATE_LIMITED", "too many requests", true],
    [502, "SPOTIFY_UNAVAILABLE", "temporarily unavailable", true],
  ] as const;
  for (const [status, code, text, retryable] of cases) {
    for (const data of [{ code }, { detail: { code } }]) {
      const error = normalizeApiError({ status, data });
      expect(error.message).toContain(text);
      expect(error.retryable).toBe(retryable);
    }
  }
});

test("explains legacy Spotify rejections and proxy validation without leaking details", () => {
  const error = normalizeApiError({
    status: 400,
    data: {
      detail: {
        error:
          "Request could not be processed. Check your input and try again.",
        used_source: "spotify",
        meta: {},
      },
    },
  });
  expect(error.message).toContain("availability or access may be restricted");
  expect(normalizeApiError(error)).toEqual(error);
  expect(
    normalizeApiError({ status: 400, data: { error: "invalid_input" } })
      .message,
  ).toContain("Spotify playlist URL");
});
