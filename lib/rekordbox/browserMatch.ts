import { parseLibraryXml, readXmlFile } from "./prepareXmlUpload";
import { MAX_XML_BYTES } from "../constants";
import {
  LOCAL_RULES_VERSION,
  type LibraryEntry,
  type LocalMatch,
  type MatchInput,
} from "./localMatcher";
import type { ApiMeta } from "../types";

const libraries = new WeakMap<
  File,
  Promise<{ entries: LibraryEntry[]; fingerprint: string }>
>();
export async function readLocalLibrary(file: File, signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (file.size > MAX_XML_BYTES)
    throw new Error("XML file too large (max 50MB).");
  let parsed = libraries.get(file);
  if (!parsed) {
    parsed = readXmlFile(file).then(async (text) => {
      const entries = parseLibraryXml(text).map((entry) => ({
        title: entry.title.trim(),
        artist: entry.artist.trim(),
        album: entry.album.trim(),
        isrc: entry.isrc,
      }));
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(
          JSON.stringify({ schema: "local-library-v1", entries }),
        ),
      );
      return {
        entries,
        fingerprint: Array.from(new Uint8Array(digest), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join(""),
      };
    });
    libraries.set(file, parsed);
    void parsed.catch(() => libraries.delete(file));
  }
  const result = await parsed;
  signal?.throwIfAborted();
  return result;
}

export async function matchInBrowser(
  tracks: MatchInput[],
  file: File,
  signal?: AbortSignal,
): Promise<{ matches: LocalMatch[]; meta: ApiMeta }> {
  const { entries, fingerprint } = await readLocalLibrary(file, signal);
  if (typeof Worker === "undefined")
    throw new Error(
      "Local matching is unavailable in this browser. Your XML has not been sent anywhere.",
    );
  const started = performance.now();
  const matches = await new Promise<LocalMatch[]>((resolve, reject) => {
    const worker = new Worker(
      new URL("./matching.worker.ts", import.meta.url),
      { type: "module" },
    );
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      worker.terminate();
    };
    const fail = (error: unknown) => {
      cleanup();
      reject(error);
    };
    const abort = () =>
      fail(signal?.reason || new DOMException("Aborted", "AbortError"));
    const timer = setTimeout(
      () =>
        fail(
          new Error("Local matching timed out. No partial result was applied."),
        ),
      30_000,
    );
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      abort();
      return;
    }
    worker.onerror = () =>
      fail(
        new Error(
          "Local matching could not start. Your XML has not been sent anywhere.",
        ),
      );
    worker.onmessage = (
      event: MessageEvent<{ matches?: LocalMatch[]; error?: string }>,
    ) => {
      if (event.data.error) {
        fail(new Error(event.data.error));
        return;
      }
      if (
        !Array.isArray(event.data.matches) ||
        event.data.matches.length !== tracks.length
      ) {
        fail(new Error("Incomplete local matching result."));
        return;
      }
      cleanup();
      resolve(event.data.matches);
    };
    worker.postMessage({ tracks, library: entries });
  });
  return {
    matches,
    meta: {
      ownership_rules_version: LOCAL_RULES_VERSION,
      match_engine: "browser-v1",
      rekordbox: {
        track_total: tracks.length,
        library_track_count: entries.length,
        library_sha256: fingerprint,
        scope: "selected_xml",
        matched_at: new Date().toISOString(),
        fuzzy_count: matches.filter((m) => m.owned_reason === "fuzzy").length,
        match_ms: Math.round(performance.now() - started),
      },
    },
  };
}
