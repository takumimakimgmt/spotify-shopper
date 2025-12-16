# QA Checklist (minimal hand-run)

Always run these before handoff. Keep scope small, high-signal.

## Analyze
- [ ] Spotify playlist analyze completes; tracks render.
- [ ] Apple playlist analyze completes (or fails with clear ErrorAlert message).

## Multiple URLs
- [ ] Mixed success/failure URLs: successful tab renders; failed tab shows ErrorAlert.

## Rekordbox XML
- [ ] Small valid XML applies owned status.
- [ ] Near-limit XML (~20MB) is rejected client-side with helpful message.
- [ ] Broken/invalid XML shows clear ErrorAlert.

## CSV Export
- [ ] CSV contains rows with titles/artists starting with `=`, `+`, `-`, `@`; cells are prefixed to neutralize formulas.

## Control Flow
- [ ] Cancel analyze during in-flight run; UI recovers.
- [ ] Re-analyze after cancel completes without mixed states.

## Mobile
- [ ] Narrow viewport: layout intact; tabs/results usable; controls tap-friendly.
