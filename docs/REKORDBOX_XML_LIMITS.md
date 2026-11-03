# Local XML limits

Original XML files up to **50 MiB**, with at most **100,000 collection entries**, are parsed locally. All entries are retained. The browser matcher runs in a dedicated Web Worker and accepts up to **10,000 playlist tracks** per operation, with a 20-second computation budget and a 30-second worker lifetime cap. Cancellation terminates the worker.

The normal browser workflow uploads **no XML and no library metadata**. Only Spotify playlist URLs are sent to the API. XML rematching performs no API request. The server's legacy XML endpoints retain their 3 MiB transfer limit for compatibility, but that limit does not apply to local matching. There is no automatic server fallback.

Malformed XML, DTD/entity declarations, multiple/missing collections, excessive structure and overlong metadata are rejected. Original XML remains in local IndexedDB until Remove or full reset. Parsing currently uses the main thread before matching moves to the worker, so large XML can briefly pause the interface.

Results apply to the selected export only. Not in XML does not establish global non-ownership. Human confirmations are separate and reversible. Local fingerprints identify retained recording metadata, not raw paths/cues.

See LOCAL_REVIEW_WORKFLOW.md for matching compatibility, review memory and test coverage.
