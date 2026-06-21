export type NormalizedApiError = {
  message: string;
  status?: number;
  code?: string;
  requestId?: string;
  detail?: unknown;
  retryable?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const s = asString(value);
    if (s) return s;
  }
  return undefined;
}

function getDetail(data: unknown): unknown {
  if (!isRecord(data)) return undefined;
  return data.detail ?? data.error ?? data.message;
}

function getNestedData(error: unknown): unknown {
  if (!isRecord(error)) return undefined;
  return error.data ?? error.response ?? error.body;
}

function hasIssues(value: unknown): boolean {
  return (
    isRecord(value) &&
    Array.isArray(value.issues) &&
    (value.name === "ZodError" || value.name === "SchemaMismatch")
  );
}

function isAbortLike(error: unknown, rawMessage?: string): boolean {
  if (!isRecord(error)) return false;
  return (
    error.name === "AbortError" ||
    error.code === "ABORT_ERR" ||
    /abort|timeout|timed out/i.test(rawMessage ?? "")
  );
}

function isNetworkLike(message?: string): boolean {
  if (!message) return false;
  return /failed to fetch|networkerror|network error|load failed|fetch failed/i.test(
    message,
  );
}

function isRetryable(status?: number, code?: string, rawMessage?: string) {
  if (status && (status === 429 || status >= 500)) return true;
  if (code && /timeout|network|unavailable|rate/i.test(code)) return true;
  return (
    isNetworkLike(rawMessage) || /timeout|timed out/i.test(rawMessage ?? "")
  );
}

function userMessage(input: {
  status?: number;
  code?: string;
  rawMessage?: string;
  detail?: unknown;
  abortLike?: boolean;
  schemaLike?: boolean;
}) {
  const raw = [
    input.code,
    input.rawMessage,
    isRecord(input.detail)
      ? pickString(input.detail.error, input.detail.message, input.detail.code)
      : asString(input.detail),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (input.abortLike || /timeout|timed out|aborted/.test(raw)) {
    return "Analysis took too long. Please try again.";
  }

  if (isNetworkLike(input.rawMessage)) {
    return "Could not reach the analysis server. Please try again.";
  }

  if (
    /invalid.*playlist|playlist_invalid|url host is not allowed|spotify playlist url|invalid url|url parameter/.test(
      raw,
    )
  ) {
    return "Enter a Spotify playlist URL, URI, or ID.";
  }

  if (/xml|rekordbox|match_snapshot|matching/.test(raw)) {
    return "Could not analyze the Rekordbox XML. Please check the file and try again.";
  }

  if (
    input.status &&
    (input.status === 429 || input.status === 502 || input.status === 503)
  ) {
    return "Could not reach the analysis server. Please try again.";
  }

  if (input.status && input.status >= 500) {
    return "Could not reach the analysis server. Please try again.";
  }

  if (input.schemaLike) {
    return "Something went wrong. Please try again.";
  }

  return "Something went wrong. Please try again.";
}

export function normalizeApiError(error: unknown): NormalizedApiError {
  const normalizedMessage = isRecord(error)
    ? asString(error.message)
    : undefined;
  if (isRecord(error) && normalizedMessage && error.retryable !== undefined) {
    return {
      message: normalizedMessage,
      status: asNumber(error.status),
      code: asString(error.code),
      requestId: pickString(error.requestId, error.request_id),
      detail: error.detail,
      retryable: Boolean(error.retryable),
    };
  }

  const data = getNestedData(error);
  const dataDetail = getDetail(data);
  const detail =
    dataDetail ?? (hasIssues(error) && isRecord(error) ? error.issues : data);

  const status = isRecord(error)
    ? (asNumber(error.status) ?? asNumber(error.statusCode))
    : undefined;
  const code = isRecord(error)
    ? pickString(
        error.code,
        error.error_code,
        isRecord(data) ? data.code : undefined,
        isRecord(data) ? data.error : undefined,
        isRecord(dataDetail) ? dataDetail.code : undefined,
        isRecord(dataDetail) ? dataDetail.error_code : undefined,
      )
    : undefined;
  const requestId = isRecord(error)
    ? pickString(
        error.requestId,
        error.request_id,
        isRecord(data) ? data.requestId : undefined,
        isRecord(data) ? data.request_id : undefined,
        isRecord(dataDetail) ? dataDetail.requestId : undefined,
        isRecord(dataDetail) ? dataDetail.request_id : undefined,
      )
    : undefined;

  const rawMessage = pickString(
    isRecord(error) ? error.message : undefined,
    isRecord(data) ? data.message : undefined,
    isRecord(data) ? data.error : undefined,
    isRecord(dataDetail) ? dataDetail.message : undefined,
    isRecord(dataDetail) ? dataDetail.error : undefined,
    asString(error),
  );
  const schemaLike = hasIssues(error);
  const abortLike = isAbortLike(error, rawMessage);

  return {
    message: userMessage({
      status,
      code,
      rawMessage,
      detail,
      abortLike,
      schemaLike,
    }),
    status,
    code,
    requestId,
    detail,
    retryable: isRetryable(status, code, rawMessage),
  };
}
