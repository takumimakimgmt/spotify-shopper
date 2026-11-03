# Reliability update — 2026-11-03

This change addresses the follow-up audit across the hosted upload path, matching, snapshots and errors. It does not deploy automatically until its PRs are merged.

- Hosted XML ceiling is now 3 MiB, leaving room for up to 1 MiB of snapshot data and multipart encoding under Vercel's 4.5 MB payload limit. Browser, proxy, backend and parser ceilings agree; legacy environment values cannot raise the hard cap. Supporting larger XML needs a separate authenticated upload design.
- Parenthetical recording details and the full artist credits are checked before confirming ownership. Intro/outro, different collaborators and conflicting recording IDs remain unverified. ISRC equality is still the strongest evidence. With the supplied real-library fixture, Fine Day Anthem moves to review because XML credits omit Opus III; no special case or invented certainty is added.
- Version 3 history saves full analysis rows and their XML metadata, with a 2 MiB budget and visible write errors. Ownership claims from older matching rules are invalidated. Legacy summary-only history loads tracks as unverified and can be retried after failure. Stale hydration responses cannot overwrite a newer analysis.
- Re-analyze all tracks with XML always checks the full playlist, independent of search/filter state. Large snapshots are batched within API limits and applied only after all batches validate. XML filename, timestamp and saved file are updated. Local XML writes resolve only after transaction commit.
- Network deadlines cover the full response body. Caller cancellation is forwarded during body reads and retry waits. Uploads are not automatically retried; safe reads honor Retry-After. The proxy no longer multiplies retries and forwards cancellation upstream. Backend Spotify requests have bounded socket waits and a cooperative retrieval deadline.
- Buy Later shows persistent-storage failures and offers retry while retaining page items. Failed reads do not overwrite unknown stored data.
- API metadata distinguishes original entry count, analyzed count, and skipped local/unavailable entries; the results screen shows skipped counts.
- The XML recheck action is a keyboard-focusable button, exposes processing/result status, and rejects oversize files before sending.
- The backend warmup now checks the backend rather than Next's own liveness endpoint and has a short best-effort deadline.
- Clear analysis history explicitly keeps XML and Buy Later. Existing XML Remove and Buy Later Clear remain separate operations. No user data was deleted during implementation.
- Empty/filter states work on desktop and mobile; Buy Later no longer uses five fixed columns on narrow screens.

Deployment order: backend first, then frontend. No new secret or hosting account is required. Existing XML above 3 MiB must be replaced; old history may need one explicit recheck. A smaller XML only covers its exported library portion, which is stated in the upload guidance.
