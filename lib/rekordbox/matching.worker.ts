/// <reference lib="webworker" />
import {
  matchLibrary,
  type LibraryEntry,
  type MatchInput,
} from "./localMatcher";
const worker = self as unknown as DedicatedWorkerGlobalScope;
worker.onmessage = (
  event: MessageEvent<{ tracks: MatchInput[]; library: LibraryEntry[] }>,
) => {
  try {
    worker.postMessage({
      matches: matchLibrary(event.data.tracks, event.data.library),
    });
  } catch (error) {
    worker.postMessage({
      error: error instanceof Error ? error.message : "Local matching failed.",
    });
  }
};
