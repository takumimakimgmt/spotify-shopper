# Local XML limits

Original XML files up to **50 MiB**, with at most **100,000 collection entries**, are parsed locally. All entries are retained. The browser matcher runs in a dedicated Web Worker and accepts up to **10,000 playlist tracks** per operation, with a 20-second computation budget and a 30-second worker lifetime cap. Cancellation terminates the worker.

The normal browser workflow uploads **no XML and no library metadata**. Only Spotify playlist URLs are sent to the API. XML rematching performs no API request. The server's legacy XML endpoints retain their 3 MiB transfer limit for compatibility, but that limit does not apply to local matching. There is no automatic server fallback.

Malformed XML, DTD/entity declarations, multiple/missing collections, excessive structure and overlong metadata are rejected. Original XML remains in local IndexedDB until Remove or full reset. Parsing currently uses the main thread before matching moves to the worker, so large XML can briefly pause the interface.

Results apply to the selected export only. Not in XML does not establish global non-ownership. Human confirmations are separate and reversible. Local fingerprints identify retained recording metadata, not raw paths/cues.

See LOCAL_REVIEW_WORKFLOW.md for matching compatibility, review memory and test coverage.

## Exact-boundary browser check (2026-11-05)

In isolated desktop Chromium, a synthetic 52,428,800-byte XML containing 25,000 collection tracks and 125,000 cue points completed the normal form-to-worker flow. All 25,000 entries were retained. Comparing a two-track synthetic Spotify response returned one match and one not-found result, in 3,937 ms from file selection through displayed results (worker matching: 479 ms). Spotify/health responses were mocked to isolate local capacity; this is not a Spotify network performance measurement. API inspection recorded GET health and GET playlist only, with no XML or metadata upload. A 52,428,801-byte input was rejected before matching. Fixtures and browser profiles are not committed.

This confirms the tested boundary and file structure on this PC, not every possible 50 MiB XML or device. The existing structure, depth, field-length and track-count limits still apply, and main-thread XML parsing can temporarily pause the interface.
