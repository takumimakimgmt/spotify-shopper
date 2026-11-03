"use client";
import { normalizeMeta, normalizeTracks } from "../api/normalize";
import { normalizeApiError, type NormalizedApiError } from "../api/errors";

const INVALID_PLAYLIST_MESSAGE = "Enter a Spotify playlist URL, URI, or ID.";

function isSpotifyPlaylistInput(value: string): boolean {
  if (/^spotify:playlist:[A-Za-z0-9]{22}$/i.test(value)) return true;
  if (/^[A-Za-z0-9]{22}$/.test(value)) return true;

  try {
    const url = new URL(value);
    const [, type, id] = url.pathname.split("/");
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      url.hostname.toLowerCase() === "open.spotify.com" &&
      type === "playlist" &&
      Boolean(id)
    );
  } catch {
    return false;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function getProp(obj: unknown, key: string): unknown {
  return isRecord(obj) ? obj[key] : undefined;
}

function getStringProp(obj: unknown, key: string): string | undefined {
  const v = getProp(obj, key);
  return typeof v === "string" ? v : undefined;
}

import {
  normalizeStoredResults,
  saveAnalysisHistory,
} from "../storage/analysisHistory";
export {
  safeJsonParse,
  normalizeStoredResults,
  restoreResultsFromStorage,
} from "../storage/analysisHistory";
import {
  readAnalysisDraft,
  saveAnalysisDraft,
  type AnalysisDraft,
} from "../storage/analysisDraft";
import { STORAGE_KEYS } from "../storage/keys";
import type { RekordboxMeta } from "../types";
import type { ApiMeta } from "../types";
// RekordboxMeta utility
const makeRekordboxMeta = (file: File | null): RekordboxMeta | null =>
  file
    ? {
        filename: file.name,
        updatedAtISO: new Date(file.lastModified).toISOString(),
      }
    : null;

import { useEffect, useRef, useState, ChangeEvent, FormEvent } from "react";
import { PlaylistRow, ResultState, PlaylistSnapshotV1 } from "../types";
import { MAX_XML_BYTES } from "../constants";
import {
  applySnapshotOwnership,
  splitSnapshot,
} from "@/lib/playlist/snapshotOwnership";
import {
  getPlaylist,
  postPlaylistWithRekordboxUpload,
  matchSnapshotWithXml,
} from "../api/playlist";
import {
  deleteSavedRekordboxXml,
  getSavedRekordboxXml,
  getSavedRekordboxXmlMeta,
  saveRekordboxXmlFile,
  type SavedRekordboxXmlMeta,
} from "../storage/savedRekordboxXml";
import { detectSourceFromUrl, sanitizeUrl } from "../utils/playlistUrl";

export const STORAGE_RESULTS = STORAGE_KEYS.history;

const ENABLE_LOCAL_PERSIST = true;
type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): boolean;
  removeItem(key: string): boolean;
};
const safeStorage: StorageLike = {
  getItem: (k) => {
    if (!ENABLE_LOCAL_PERSIST || typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    if (!ENABLE_LOCAL_PERSIST || typeof window === "undefined") return false;
    try {
      window.localStorage.setItem(k, v);
      return true;
    } catch {
      return false;
    }
  },
  removeItem: (k) => {
    if (!ENABLE_LOCAL_PERSIST || typeof window === "undefined") return false;
    try {
      window.localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  },
};

export { categorizeTrack } from "../domain/libraryMatch";

function mapTracks(rows: PlaylistRow[]): PlaylistRow[] {
  return rows;
}

function errorToMeta(error: NormalizedApiError) {
  return {
    status: error.status,
    code: error.code,
    error_code: error.code,
    requestId: error.requestId,
    retryable: error.retryable,
    detail: error.detail,
  };
}

function xmlTooLargeMessage(file: File): string {
  const mb = (file.size / (1024 * 1024)).toFixed(1);
  return `XML is too large (${mb} MB). Please export a smaller Rekordbox XML and try again.`;
}

function validateXmlSize(file: File | null): string | null {
  if (!file) return null;
  return file.size > MAX_XML_BYTES ? xmlTooLargeMessage(file) : null;
}

export function usePlaylistAnalyzer() {
  const hydrateInFlightRef = useRef<Set<string>>(new Set());
  const hydrateAttemptedRef = useRef<Set<string>>(new Set());
  const [multiResults, setMultiResults] = useState<
    Array<[string, ResultState]>
  >([]);
  const [storageHydrated, setStorageHydrated] = useState(false);
  const historyWritableRef = useRef(false);
  const [resumableDraft, setResumableDraft] = useState<AnalysisDraft | null>(
    null,
  );
  const resumeRef = useRef<AnalysisDraft | null>(null);
  const draftWritableRef = useRef(false);

  useEffect(() => {
    try {
      setResumableDraft(readAnalysisDraft());
      draftWritableRef.current = true;
    } catch {
      setStorageWarning(
        "Saved progress could not be read. Existing data has been kept. Explicitly discard saved progress or clear analysis history to start again.",
      );
    }
  }, []);

  // タブ切替時にtracks未定義ならAPIでhydrate
  const _ensureHydrated = async (url: string, retry = false) => {
    if (
      hydrateInFlightRef.current.has(url) ||
      (!retry && hydrateAttemptedRef.current.has(url))
    )
      return;
    const idx = multiResults.findIndex(([u]) => u === url);
    if (idx === -1) return;
    const [_, result] = multiResults[idx];
    if (result.tracks && result.tracks.length > 0) return;
    hydrateAttemptedRef.current.add(url);
    hydrateInFlightRef.current.add(url);
    try {
      const detectedSource = detectSourceFromUrl(url);
      const json = await getPlaylist({ url, source: detectedSource });
      const rows = mapTracks(normalizeTracks(json));
      setMultiResults((prev) =>
        prev.map(([u, r]) =>
          u === url && r === result
            ? [
                u,
                {
                  ...r,
                  tracks: rows,
                  total: rows.length,
                  errorText: null,
                  analyzedAt: Date.now(),
                  hasRekordboxData: false,
                  rekordboxMeta: null,
                  meta: normalizeMeta(getProp(json, "meta")) as ApiMeta,
                },
              ]
            : [u, r],
        ),
      );
    } catch (_err) {
      const normalized = normalizeApiError(_err);
      setMultiResults((prev) =>
        prev.map(([u, r]) =>
          u === url && r === result
            ? [u, { ...r, errorText: normalized.message, tracks: [] }]
            : [u, r],
        ),
      );
    } finally {
      hydrateInFlightRef.current.delete(url);
    }
  };

  // Never overwrite history that could not be read or validated.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_RESULTS);
      if (saved !== null) {
        const restored = normalizeStoredResults(JSON.parse(saved));
        if (!restored) throw new Error("Invalid saved history");
        setMultiResults(restored);
      }
      historyWritableRef.current = true;
      setStorageHydrated(true);
    } catch {
      setStorageWarning(
        "Analysis history could not be read. Existing data has been kept. Clear analysis history explicitly to start saving again.",
      );
    }
    const onStorage = (event: StorageEvent) => {
      if (
        event.key !== STORAGE_RESULTS &&
        event.key !== STORAGE_KEYS.analysisDraft &&
        event.key !== null
      )
        return;
      historyWritableRef.current = false;
      setStorageHydrated(false);
      abortRef.current?.abort();
      setStorageWarning(
        "Analysis history changed in another tab. Saving is paused to protect it. Reload this page to use the latest saved results.",
      );
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const [playlistUrlInput, setPlaylistUrlInputState] = useState("");
  const playlistUrlInputRef = useRef("");
  const setPlaylistUrlInput = (value: string) => {
    playlistUrlInputRef.current = value;
    setPlaylistUrlInputState(value);
  };
  const [rekordboxFile, setRekordboxFile] = useState<File | null>(null);
  const [rekordboxDate, setRekordboxDate] = useState<string | null>(null);
  const [savedRekordboxXmlMeta, setSavedRekordboxXmlMeta] =
    useState<SavedRekordboxXmlMeta | null>(null);
  const [savedRekordboxXmlBusy, setSavedRekordboxXmlBusy] = useState(false);
  const [savedRekordboxXmlError, setSavedRekordboxXmlError] = useState<
    string | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !storageHydrated) return;
    if (localStorageDebounceRef.current) {
      clearTimeout(localStorageDebounceRef.current);
      localStorageDebounceRef.current = null;
    }

    if (!multiResults.length) {
      const removed = safeStorage.removeItem(STORAGE_RESULTS);
      setStorageWarning(removed ? null : "ローカルデータの削除に失敗しました");
      return;
    }

    localStorageDebounceRef.current = setTimeout(() => {
      try {
        saveAnalysisHistory(multiResults);
        setStorageWarning(null);
      } catch (error) {
        setStorageWarning(
          error instanceof Error
            ? error.message
            : "Analysis history could not be saved. Keep this page open and free browser storage.",
        );
      }
      localStorageDebounceRef.current = null;
    }, 500);

    return () => {
      if (localStorageDebounceRef.current) {
        clearTimeout(localStorageDebounceRef.current);
        localStorageDebounceRef.current = null;
      }
    };
  }, [multiResults, storageHydrated]);

  // rekordboxファイルと日付をセットで管理する共通関数
  const applyRekordboxFile = (file: File | null) => {
    setRekordboxFile(file);
    if (file && typeof file.lastModified === "number") {
      const date = new Date(file.lastModified);
      setRekordboxDate(date.toLocaleString());
    } else {
      setRekordboxDate(null);
    }
  };

  useEffect(() => {
    let cancelled = false;

    getSavedRekordboxXmlMeta()
      .then((meta) => {
        if (!cancelled) setSavedRekordboxXmlMeta(meta);
      })
      .catch(() => {
        if (!cancelled) {
          setSavedRekordboxXmlMeta(null);
          setSavedRekordboxXmlError("Saved XML is not available.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const persistRekordboxFile = async (file: File) => {
    const sizeError = validateXmlSize(file);
    if (sizeError) {
      setSavedRekordboxXmlError(sizeError);
      return;
    }

    setSavedRekordboxXmlBusy(true);
    setSavedRekordboxXmlError(null);
    try {
      const meta = await saveRekordboxXmlFile(file);
      setSavedRekordboxXmlMeta(meta);
    } catch {
      setSavedRekordboxXmlError("Could not save XML locally.");
    } finally {
      setSavedRekordboxXmlBusy(false);
    }
  };

  const useSavedRekordboxXml = async () => {
    setSavedRekordboxXmlBusy(true);
    setSavedRekordboxXmlError(null);
    try {
      const saved = await getSavedRekordboxXml();
      if (!saved) {
        setSavedRekordboxXmlMeta(null);
        setSavedRekordboxXmlError("No saved XML found.");
        return;
      }
      const sizeError = validateXmlSize(saved.file);
      if (sizeError) {
        setSavedRekordboxXmlError(sizeError);
        return;
      }
      applyRekordboxFile(saved.file);
      setSavedRekordboxXmlMeta(saved.meta);
    } catch {
      setSavedRekordboxXmlError("Could not load saved XML.");
    } finally {
      setSavedRekordboxXmlBusy(false);
    }
  };

  const forgetSavedRekordboxXml = async () => {
    setSavedRekordboxXmlBusy(true);
    setSavedRekordboxXmlError(null);
    try {
      await deleteSavedRekordboxXml();
      setSavedRekordboxXmlMeta(null);
      applyRekordboxFile(null);
    } catch {
      setSavedRekordboxXmlError("Could not forget saved XML.");
    } finally {
      setSavedRekordboxXmlBusy(false);
    }
  };

  const resolveActiveRekordboxFile = async (): Promise<File | null> => {
    if (rekordboxFile) return rekordboxFile;
    if (!savedRekordboxXmlMeta) return null;

    setSavedRekordboxXmlBusy(true);
    setSavedRekordboxXmlError(null);
    try {
      const saved = await getSavedRekordboxXml();
      if (!saved) {
        setSavedRekordboxXmlMeta(null);
        setSavedRekordboxXmlError("No saved XML found.");
        return null;
      }
      const sizeError = validateXmlSize(saved.file);
      if (sizeError) {
        setSavedRekordboxXmlError(sizeError);
        return null;
      }
      applyRekordboxFile(saved.file);
      setSavedRekordboxXmlMeta(saved.meta);
      return saved.file;
    } catch {
      setSavedRekordboxXmlError("Could not load saved XML.");
      return null;
    } finally {
      setSavedRekordboxXmlBusy(false);
    }
  };
  const [progress, setProgress] = useState<number>(0);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [errorMeta, setErrorMeta] = useState<any>(null);
  const [forceRefreshHint, setForceRefreshHint] = useState(false);
  const [reAnalyzeUrl, setReAnalyzeUrl] = useState<string | null>(null);
  // Progress items for per-URL status visualization
  type ProgressStatus = "pending" | "fetching" | "parsing" | "done" | "error";
  const [progressItems, setProgressItems] = useState<
    Array<{ url: string; status: ProgressStatus; message?: string }>
  >([]);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [phaseLabel, setPhaseLabel] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<number>(0);
  useEffect(
    () => () => {
      requestIdRef.current += 1;
      abortRef.current?.abort();
    },
    [],
  );
  const progressTimer = useRef<number | null>(null);
  const reAnalyzeInputRef = useRef<HTMLInputElement | null>(null);
  const localStorageDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const clearLocalData = () => {
    requestIdRef.current += 1;
    abortRef.current?.abort();
    setLoading(false);
    setIsReanalyzing(false);
    setProgressItems([]);
    setPhaseLabel(null);
    const removed = safeStorage.removeItem(STORAGE_RESULTS);
    if (removed) {
      historyWritableRef.current = true;
      setStorageHydrated(true);
    }
    setMultiResults([]);
    setPlaylistUrlInput("");
    hydrateAttemptedRef.current.clear();
    try {
      saveAnalysisDraft(null);
      draftWritableRef.current = true;
      setResumableDraft(null);
      setStorageWarning(
        removed ? null : "Analysis history could not be removed.",
      );
    } catch {
      setStorageWarning("Saved progress could not be removed.");
    }
  };

  // selectedKey is managed by selection, not analyzer
  // currentResult is now derived in viewModel

  // (formCollapsed is now managed only by selection)

  const isProcessing = loading || isReanalyzing;

  useEffect(() => {
    if (!isProcessing || progressItems.length === 0) {
      setProgress(0);
      return;
    }

    const weights: Record<string, number> = {
      pending: 0,
      fetching: 0.35,
      parsing: 0.75,
      done: 1,
      error: 1,
    };

    const avg =
      progressItems.reduce(
        (acc, item) => acc + (weights[item.status] ?? 0),
        0,
      ) / progressItems.length;

    setProgress(Math.max(0, Math.min(100, Math.round(avg * 100))));
  }, [isProcessing, progressItems]);

  const handleRekordboxChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    const sizeError = validateXmlSize(file);
    if (sizeError) {
      applyRekordboxFile(null);
      setSavedRekordboxXmlError(sizeError);
      e.target.value = "";
      return;
    }
    setSavedRekordboxXmlError(null);
    applyRekordboxFile(file);
    if (file) {
      void persistRekordboxFile(file);
    }
  };

  const handleReAnalyzeFileChange = async (
    e: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeError = validateXmlSize(file);
    if (sizeError) {
      setErrorText(sizeError);
      setErrorMeta(errorToMeta({ message: sizeError, code: "XML_TOO_LARGE" }));
      e.target.value = "";
      return;
    }
    // Re-analyze/BulkでもXML日時を更新
    applyRekordboxFile(file);
    const isBulk = reAnalyzeUrl === "__BULK__";
    setIsReanalyzing(true);
    setLoading(false);
    setErrorText(null);
    setErrorMeta(null);

    try {
      if (isBulk) {
        const updatedResults: Array<[string, ResultState]> = [];
        for (const [url, result] of multiResults) {
          try {
            const detectedSource = detectSourceFromUrl(url);
            const json = await postPlaylistWithRekordboxUpload({
              url,
              source: detectedSource,
              file,
            });
            const rows = mapTracks(normalizeTracks(json));
            updatedResults.push([
              url,
              {
                ...result,
                tracks: rows,
                analyzedAt: Date.now(),
                hasRekordboxData: true,
                rekordboxMeta: makeRekordboxMeta(file),
              },
            ]);
          } catch (_err) {
            console.error(`[Bulk Re-analyze] Error for ${url}:`, _err);
            updatedResults.push([url, result]);
          }
        }
        setMultiResults(updatedResults);
        setErrorText(null);
        setErrorMeta(null);
        return;
      }

      if (!reAnalyzeUrl) {
        setErrorText("プレイリストURLが見つかりません");
        return;
      }
      const existingResult = multiResults.find(
        ([url]) => url === reAnalyzeUrl,
      )?.[1];
      if (!existingResult) {
        setErrorText("プレイリストが見つかりません");
        return;
      }

      const detectedSource = detectSourceFromUrl(reAnalyzeUrl);
      const json = await postPlaylistWithRekordboxUpload({
        url: reAnalyzeUrl,
        source: detectedSource,
        file,
      });
      const rows = mapTracks(normalizeTracks(json));
      setMultiResults((prev) =>
        prev.map(([url, result]) =>
          url === reAnalyzeUrl
            ? [
                url,
                {
                  ...result,
                  tracks: rows,
                  analyzedAt: Date.now(),
                  hasRekordboxData: true,
                  rekordboxMeta: makeRekordboxMeta(file),
                },
              ]
            : [url, result],
        ),
      );
      setErrorText(null);
      setErrorMeta(null);
    } catch (_err) {
      const normalized = normalizeApiError(_err);
      console.error("[Re-analyze] Error:", _err);
      setErrorMeta(errorToMeta(normalized));
      setErrorText(normalized.message);
    } finally {
      setIsReanalyzing(false);
      setReAnalyzeUrl(null);
      if (reAnalyzeInputRef.current) reAnalyzeInputRef.current.value = "";
    }
  };

  const handleAnalyze = async (e: FormEvent) => {
    e.preventDefault();
    setErrorText(null);
    setErrorMeta(null);
    setPhaseLabel("Preparing");
    // Use forceRefreshHint from state (set by button onClick) instead of unreliable FormEvent.shiftKey
    const isForceRefresh = forceRefreshHint;
    if (isForceRefresh) {
      window.setTimeout(() => setForceRefreshHint(false), 2000);
    }

    const resume = resumeRef.current;
    resumeRef.current = null;
    const urls = [
      ...new Set(
        playlistUrlInputRef.current
          .split("\n")
          .map((line) => sanitizeUrl(line))
          .filter((url) => url.length > 0),
      ),
    ];
    if (urls.length > 50) {
      setErrorText("Check at most 50 playlists in one batch.");
      return;
    }
    if (urls.length === 0) {
      setErrorText("Please enter at least one playlist URL or ID.");
      setPhaseLabel(null);
      return;
    }

    const invalidUrl = urls.find((url) => !isSpotifyPlaylistInput(url));
    if (invalidUrl) {
      setErrorText(INVALID_PLAYLIST_MESSAGE);
      setErrorMeta(
        errorToMeta({
          message: INVALID_PLAYLIST_MESSAGE,
          code: "PLAYLIST_INVALID",
          detail: { url: invalidUrl.substring(0, 80) },
          retryable: false,
        }),
      );
      setPhaseLabel(null);
      return;
    }

    const activeRekordboxFile =
      resume && !resume.useXml ? null : await resolveActiveRekordboxFile();
    if (resume?.useXml && !activeRekordboxFile) {
      setErrorText("Choose the XML for this batch before resuming.");
      return;
    }
    if (
      !(resume && !resume.useXml) &&
      savedRekordboxXmlMeta &&
      !activeRekordboxFile
    ) {
      setErrorText(
        "Saved XML could not be loaded. Replace or remove it before continuing.",
      );
      return;
    }
    const xmlSizeError = validateXmlSize(activeRekordboxFile);
    if (xmlSizeError) {
      setErrorText(xmlSizeError);
      setErrorMeta(
        errorToMeta({ message: xmlSizeError, code: "XML_TOO_LARGE" }),
      );
      setPhaseLabel(null);
      return;
    }

    if (!historyWritableRef.current || !draftWritableRef.current) {
      setErrorText(
        "Saved history or progress needs attention before starting. Reload to load the latest history, or explicitly clear analysis history.",
      );
      return;
    }
    let draft: AnalysisDraft = {
      version: 1,
      pendingUrls: urls,
      useXml: !!activeRekordboxFile,
      xmlFilename: activeRekordboxFile?.name,
      refresh: resume?.refresh ?? isForceRefresh,
      updatedAt: Date.now(),
    };
    try {
      saveAnalysisDraft(draft);
      setResumableDraft(draft);
    } catch {
      setStorageWarning(
        "Progress could not be saved. Keep this page open until the batch finishes.",
      );
    }
    let checkpointResults = multiResults;

    // Initialize progress items for each URL
    setProgressItems(
      urls.map((url) => ({ url, status: "pending" as ProgressStatus })),
    );

    if (abortRef.current) {
      try {
        abortRef.current.abort();
      } catch {}
    }
    const requestController = new AbortController();
    abortRef.current = requestController;
    const localRequestId = requestIdRef.current + 1;
    requestIdRef.current = localRequestId;

    setLoading(true);
    setProgress(0);
    if (progressTimer.current) {
      window.clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
    const newResults: Array<[string, ResultState]> = [];
    let hasError = false;

    for (const url of urls) {
      try {
        const t0 = performance.now();
        const t1_start = t0;
        setPhaseLabel("Fetching Spotify...");
        setProgressItems((prev) =>
          prev.map((p) =>
            p.url === url
              ? {
                  ...p,
                  status: "fetching",
                  message: isForceRefresh ? "Reloading" : "Loading",
                }
              : p,
          ),
        );

        const t2_api_start = performance.now();
        let json: unknown | null = null;

        const fetchOnce = async () => {
          if (activeRekordboxFile) {
            return postPlaylistWithRekordboxUpload({
              url,
              source: "spotify",
              file: activeRekordboxFile,
              refresh: draft.refresh,
              signal: requestController.signal,
            });
          }
          return getPlaylist({
            url,
            source: "spotify",
            refresh: draft.refresh,
            signal: requestController.signal,
          });
        };

        json = await fetchOnce();
        const t3_api_done = performance.now();

        if (localRequestId !== requestIdRef.current) {
          continue;
        }

        if (!json) {
          throw new Error("Failed to fetch playlist data");
        }

        if (activeRekordboxFile) {
          setPhaseLabel("Matching Rekordbox");
          setProgressItems((prev) =>
            prev.map((p) =>
              p.url === url
                ? { ...p, status: "parsing", message: "Matching Rekordbox" }
                : p,
            ),
          );
        }

        const t4_mapstart = performance.now();
        const rows = mapTracks(normalizeTracks(json));
        const t5_mapdone = performance.now();
        const api_ms = t3_api_done - t2_api_start;
        const map_ms = t5_mapdone - t4_mapstart;
        const total_ms = performance.now() - t1_start;
        const overhead_ms = Math.max(0, total_ms - api_ms - map_ms);
        const payload_bytes = new Blob([JSON.stringify(json)]).size;
        const metaWithTiming: ApiMeta = {
          ...(normalizeMeta(getProp(json, "meta")) ?? {}),
          client_total_ms: total_ms,
          client_api_ms: api_ms,
          client_map_ms: map_ms,
          client_overhead_ms: overhead_ms,
          payload_bytes,
        };
        newResults.push([
          url,
          {
            title: getStringProp(json, "playlist_name") ?? "(unknown)",
            total: rows.length,
            playlistUrl: getStringProp(json, "playlist_url") ?? url,
            playlist_id: getStringProp(json, "playlist_id") ?? "",
            playlist_name: getStringProp(json, "playlist_name") ?? "(unknown)",
            tracks: rows,
            analyzedAt: Date.now(),
            hasRekordboxData: !!activeRekordboxFile,
            meta: metaWithTiming,
          },
        ]);
        const finished = newResults[newResults.length - 1];
        finished[1].rekordboxMeta = makeRekordboxMeta(activeRekordboxFile);
        checkpointResults = [
          finished,
          ...checkpointResults.filter(([key]) => key !== url),
        ];
        setMultiResults(checkpointResults);
        try {
          // Save the completed result before removing it from pending work.
          if (!historyWritableRef.current)
            throw new Error("Saving is paused to protect existing history.");
          saveAnalysisHistory(checkpointResults);
          draft = {
            ...draft,
            pendingUrls: draft.pendingUrls.filter((pending) => pending !== url),
            updatedAt: Date.now(),
          };
          saveAnalysisDraft(draft);
          setResumableDraft(draft.pendingUrls.length ? draft : null);
        } catch {
          setStorageWarning(
            "Completed results are on this page, but progress could not be saved. Keep this page open; resuming may repeat the last playlist.",
          );
        }
        // Mark success
        setProgressItems((prev) =>
          prev.map((p) =>
            p.url === url
              ? { ...p, status: "done", message: `${rows.length} tracks` }
              : p,
          ),
        );

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const t7_raf2 = performance.now();
            const totalMs = t7_raf2 - t1_start;
            const payloadBytes = new Blob([JSON.stringify(json)]).size;
            const api_ms = t3_api_done - t2_api_start;
            const map_ms = t5_mapdone - t4_mapstart;
            const overhead_ms = totalMs - api_ms - map_ms;
            console.log(
              `[PERF] url=${url.substring(0, 60)} tracks=${rows.length}\n` +
                `  Total: ${totalMs.toFixed(1)}ms | API: ${api_ms.toFixed(1)}ms | Map: ${map_ms.toFixed(1)}ms | Overhead: ${overhead_ms.toFixed(1)}ms\n` +
                `  Payload: ${payloadBytes} bytes | TTFB+API: ${(t3_api_done - t1_start).toFixed(1)}ms`,
            );
          });
        });
      } catch (_err: any) {
        if (
          requestController.signal.aborted ||
          localRequestId !== requestIdRef.current
        ) {
          break;
        }
        hasError = true;
        const normalized = normalizeApiError(_err);
        const progressMessage = normalized.code ?? normalized.message;
        setProgressItems((prev) =>
          prev.map((p) =>
            p.url === url
              ? {
                  ...p,
                  status: "error",
                  message: progressMessage,
                }
              : p,
          ),
        );
        setErrorMeta({
          ...errorToMeta(normalized),
          url: url.substring(0, 80),
          source: detectSourceFromUrl(url) || "spotify",
          refresh: isForceRefresh ? 1 : 0,
        });
        setErrorText(normalized.message);
      }
    }

    if (localRequestId !== requestIdRef.current) return;

    if (newResults.length > 0) setPlaylistUrlInput("");

    if (hasError && newResults.length === 0) {
      setErrorText(
        (prev) => prev ?? "Failed to load playlists. Check URLs and try again.",
      );
    }

    setProgress(100);
    setTimeout(() => setProgress(0), 600);
    setLoading(false);
    if (progressTimer.current) {
      window.clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
    setPhaseLabel(null);
  };

  const applySnapshotWithXml = async (
    file: File,
    currentResult: ResultState,
    _displayedTracks: PlaylistRow[],
  ) => {
    const sizeError = validateXmlSize(file);
    if (sizeError) throw new Error(sizeError);
    // This action always rechecks the full playlist, regardless of visible filters.
    const baseTracks = Array.isArray(currentResult.tracks)
      ? currentResult.tracks
      : [];
    if (baseTracks.length === 0)
      throw new Error("Load the playlist tracks before checking XML.");
    const snapshot: PlaylistSnapshotV1 = {
      schema: "playlist_snapshot",
      version: 1,
      created_at: new Date().toISOString(),
      playlist: {
        source: "spotify",
        url: currentResult.playlistUrl || "",
        id: currentResult.playlist_id,
        name: currentResult.playlist_name,
        track_count: currentResult.total,
      },
      tracks: baseTracks.map((t) => {
        const primaryKey =
          t.trackKeyPrimary || t.trackKeyFallback || `${t.title}::${t.artist}`;
        const fallbackKey =
          t.trackKeyFallback || t.trackKeyPrimary || `${t.title}::${t.artist}`;
        return {
          title: t.title,
          artist: t.artist,
          album: t.album ?? "",
          isrc: t.isrc ?? null,
          owned: typeof t.owned === "boolean" ? t.owned : undefined,
          owned_reason: t.ownedReason ?? null,
          track_key_primary: primaryKey,
          track_key_fallback: fallbackKey,
          track_key_version: "v1",
          track_key_primary_type:
            (t.trackKeyPrimaryType as "isrc" | "norm") || "norm",
          links: {
            beatport: t.stores?.beatport,
            bandcamp: t.stores?.bandcamp,
            itunes: t.stores?.itunes,
            spotify: t.spotifyUrl,
            apple: t.appleUrl,
          },
        };
      }),
    };

    const matchedTracks: unknown[] = [];
    let matchMeta: Record<string, unknown> = {};
    let comparedFingerprint: unknown;
    let comparedRules: unknown;
    let matchMilliseconds = 0;
    let fuzzyCount = 0;
    for (const batch of splitSnapshot(snapshot)) {
      const json = await matchSnapshotWithXml(JSON.stringify(batch), file);
      const rows = getProp(json, "tracks");
      if (!Array.isArray(rows) || rows.length !== batch.tracks.length)
        throw new Error("Incomplete XML matching response. Please retry.");
      matchedTracks.push(...rows);
      matchMeta = normalizeMeta(getProp(json, "meta")) ?? {};
      const xmlMeta = getProp(matchMeta, "rekordbox");
      const fingerprint = getProp(xmlMeta, "library_sha256");
      const rules = getProp(matchMeta, "ownership_rules_version");
      if (
        (comparedFingerprint !== undefined &&
          fingerprint !== comparedFingerprint) ||
        (comparedRules !== undefined && rules !== comparedRules)
      ) {
        throw new Error(
          "Matching data changed during the batch. Recheck all tracks.",
        );
      }
      comparedFingerprint = fingerprint;
      comparedRules = rules;
      matchMilliseconds += Number(getProp(xmlMeta, "match_ms")) || 0;
      fuzzyCount += Number(getProp(xmlMeta, "fuzzy_count")) || 0;
    }
    if (isRecord(matchMeta.rekordbox)) {
      matchMeta.rekordbox = {
        ...matchMeta.rekordbox,
        track_total: baseTracks.length,
        match_ms: matchMilliseconds,
        fuzzy_count: fuzzyCount,
      };
    }
    // Validate before scheduling a state update so failures reach the XML UI.
    applySnapshotOwnership(baseTracks, baseTracks, matchedTracks);
    setMultiResults((prev) =>
      prev.map(([url, result]) => {
        if (result !== currentResult) return [url, result];
        return [
          url,
          {
            ...result,
            tracks: applySnapshotOwnership(
              result.tracks,
              baseTracks,
              matchedTracks,
            ),
            hasRekordboxData: true,
            rekordboxMeta: makeRekordboxMeta(file),
            analyzedAt: Date.now(),
            meta: { ...result.meta, ...matchMeta },
          },
        ];
      }),
    );
    applyRekordboxFile(file);
    await persistRekordboxFile(file);
  };

  const cancelAnalyze = () => {
    requestIdRef.current += 1;
    try {
      abortRef.current?.abort();
    } catch {
      // ignore
    }
    setLoading(false);
    setIsReanalyzing(false);
    setProgress(0);
    setProgressItems([]);
    setPhaseLabel(null);
  };

  const retryFailed = () => {
    const failedUrls = progressItems
      .filter((p) => p.status === "error")
      .map((p) => p.url);
    if (failedUrls.length === 0) return;
    playlistUrlInputRef.current = failedUrls.join("\n");
    setPlaylistUrlInputState(playlistUrlInputRef.current);
    handleAnalyze({ preventDefault: () => {} } as unknown as FormEvent);
  };

  const resumeAnalysis = () => {
    if (isProcessing || !resumableDraft) return;
    resumeRef.current = resumableDraft;
    setPlaylistUrlInput(resumableDraft.pendingUrls.join("\n"));
    void handleAnalyze({ preventDefault: () => {} } as FormEvent);
  };
  const discardAnalysisDraft = () => {
    if (isProcessing) return;
    try {
      saveAnalysisDraft(null);
      draftWritableRef.current = true;
      setResumableDraft(null);
    } catch {
      setStorageWarning("Saved progress could not be removed.");
    }
  };

  return {
    resumableDraft,
    resumeAnalysis,
    discardAnalysisDraft,
    // data & state
    playlistUrlInput,
    setPlaylistUrlInput,
    rekordboxFile,
    setRekordboxFile: applyRekordboxFile,
    rekordboxDate,
    savedRekordboxXmlMeta,
    savedRekordboxXmlBusy,
    savedRekordboxXmlError,
    useSavedRekordboxXml,
    forgetSavedRekordboxXml,
    multiResults,
    setMultiResults,
    loading,
    isReanalyzing,
    isProcessing,
    progress,
    errorText,
    setErrorText,
    errorMeta,
    forceRefreshHint,
    setForceRefreshHint,
    progressItems,
    phaseLabel,
    cancelAnalyze,
    retryFailed,
    storageWarning,
    clearLocalData,
    reAnalyzeUrl,
    setReAnalyzeUrl,
    reAnalyzeInputRef,
    // handlers
    handleAnalyze,
    handleRekordboxChange,
    handleReAnalyzeFileChange,
    applySnapshotWithXml,
    ensureHydrated: _ensureHydrated,
  };
}
