# Playlist Shopper design system

## Product and scope

A PC-first DJ purchase research tool: public Spotify playlist → optional local rekordbox XML comparison → review tracks → Beatport search or product link → browser-local Buy Later. Bandcamp is secondary. XML absence never proves global non-ownership. Saved candidates still require the existing absence result; this design pass does not broaden eligibility, modify matching, or verify store availability/version.

## Direction

Carry the existing social cover's bold type, dark ground, off-white text and restrained green accent into the input view. Keep the groove illustration on the social cover; a faint cropped circle behind text did not make a useful app composition and has been removed. Keep long result lists quiet. Do not add decorative imagery, autoplay, new fonts, UI libraries, paid services or tracking to create personality.

## Rules

- Track title/version and artist credits take priority over controls. Full text wraps on PC, mobile and saved lists; no hover-only recovery of the mix name.
- State meanings are shared: matched/confirmed, absent from XML, needs review, not checked. Unchecked is neutral; amber means evidence needs review. Manual different-version decisions remain review, not purchase eligibility.
- Input and result widths intentionally differ: start max 48rem; workspace max 1200px. Space scale: 4, 8, 12, 16, 24, 32, 48px.
- Desktop uses table rows; mobile uses divided rows with the same identity, store links and status. Below 1024px, tools do not stick; search/sort use a disclosure. Desktop tools remain visible without opening the mobile disclosure.
- XML checking is directly visible when missing; replacement/export are secondary tools. Errors/progress remain visible even if tools are closed.
- Shared actions have at least 44px height. Focus is an accent outline with offset. Keep native dialog focus, Escape and return-to-opener behavior.
- First-order action: solid accent; secondary: outlined; store search: restrained accent outline. Success also uses a check/text; never rely on color alone.

## Tokens and typography

`app/globals.css` is the source of truth: canvas #080A0B, surface #101517, foreground #F2F0E8, secondary #C4CBC9, muted #98A5A1, accent #69DDB0, review #E6C16C, danger #F19B9B. Input border #66746E. Control radius 8px, panel radius 12px, motion 160ms. Normal text must reach 4.5:1; visible control boundaries should reach 3:1 where required.

Use the already-loaded Geist family with Hiragino/Yu Gothic/Meiryo Japanese system fallback. No extra font download. Track titles 16/24px, artist credits 14/20px, albums 13px; essential states at least 12px. Monospace is for technical data only; use tabular figures for counts. Heading scale 30–36px on entry, 24px for playlist title.

## Shared components

TrackPresentation: identity/listening/store links. ResultsTable: desktop/mobile arrangement, status, evidence and pagination. ResultsSearchTools: shared controlled search/sort for desktop and mobile. BuyLaterDrawer/Panel: native modal and queue presentation. ResultsFilterBar: counts, category definitions and search/sort in one shared control. ResultSummaryBar remains a legacy component and is not used by the live page. ProcessingBar: indeterminate network activity vs real bounded match progress.

Native dialog/shadow/backdrop and technical detail text are intentional exceptions to ordinary flat rows. Existing .ps-\* utilities remain compatibility aliases; do not create a second design vocabulary. Use ps-action-primary/secondary for shared actions. New components should adopt semantic tokens rather than hardcoded surface/text colors.

## Motion and verification

Use short feedback transitions; no staggered row entrances. Respect prefers-reduced-motion for pulse, transitions and smooth scrolling. Progress exposes an accessible name and determinate values only when known.

Check 320/390/768/1024/1440px; Japanese and English; long remixes and multiple artist credits; no XML, matched, absent, review; empty results; storage error; queue duplicate counts and all-page saving; focus, Escape, pagination/search and CSV. Preserve local XML privacy and original metadata. Match accuracy, purchase conversions and actual large-file performance require separate validation.

## Finishing rules

The full track identity opens recording evidence: use a subtle underline on the title and a minimum 44px identity target. Do not reserve a separate column for repeated Listen/Spotify controls or arrows. Title and artist stay together. Put the explicitly named source-service link inside the comparison. Desktop results have three columns (track, store, save); status and evidence toggle belong beneath the identity. Saved rows use quiet text/checks, not repeated disabled action buttons. When the filtered set is fully saved, show one count plus a link opening the shared saved list; hide redundant completion/exclusion explanations. Before saving, exclusion counts remain available in a disclosure. Selected XML uses a compact metadata/change/remove row; optional upload instructions are for the unselected state. Privacy/scope warnings and errors remain available in both states.

## Matching trust and workspace flow

- Input and results are separate views. Checking another playlist preserves history, XML and Buy Later. A successful completion selects its result; a failed request keeps the input error and a Back to saved results action. Do not infer a new completion from unrelated result-object changes. Restore browser selection after hydration, before writing it back.
- Counts are interactive category controls, including zero unchecked tracks. One adjacent hint follows the selected category; the checked XML entry count remains visible. Desktop controls stick; below 1024px they scroll normally. Combined purchase planning is a closed secondary section after the track list.
- Verdict, eligibility, labels and counts share `libraryMatch.ts`. Explicit contradictions in saved evidence require review; preserve raw evidence. Manual confirmation is identified separately and never rewrites the XML. Normalized exact/ISRC matches can have textual differences: comparisons must say **text differs**, not imply another automatic verdict.
- Missing candidates are not fabricated. Absence is scoped to the selected export; metadata differences remain possible. Correction controls explain their effect. Review rows explain why saving is unavailable and how to inspect evidence.
- Initial checks have no previous-change annotations. Unknown/zero XML modification dates show Date unknown, not 1970. Nonretryable errors offer guidance without Retry; progress and cancellation stay by the submit action.
- Show affiliate and unverified-version disclosure in the visible store-help summary. Queue additions remain newest first, batches retain playlist order. Removing/clearing has visible Undo; undo deduplicates and restores original positions. Storage-conflict guards still apply.

Verification for this change: real 1121.xml was checked locally against Air/98 (18 absent, 69 matched, 11 review). XML contents were never sent to a server or committed. Controlled metadata fixtures verify success/failure of additional playlists without provider dependency. Regression tests cover contradictory evidence, first-check changes, filter hints/counts, zero timestamps, no-Retry errors, queue undo and hydration-safe selection restoration.

Source navigation is carried by the shared track identity in results and Buy Later. Its tooltip and accessible name identify Spotify (or YouTube Music search when no Spotify URL exists) and the new tab. No in-app playback is implied. Batch saving is a secondary outlined action; store search retains restrained accent emphasis. Filter counts occupy a full row; search/sort and Buy Later align beneath them instead of unpredictable wrapping.

## Audit acceptance criteria

Apply the original audit as principles, not an arbitrary ban on cards or icons. An external-link arrow was not prohibited by the original document; repeating it in every row without helping the purchase task is unnecessary here. For each change record its purpose, screen, evidence and impact. Keep aesthetic preferences separate from measurable faults. Labels alone do not fix an inappropriate layout.

Review the entry, result list, recording comparison, Buy Later and error states in both languages and at 320/390/768/1024/1440px. Check title/version visibility, category meaning, source/store/save hierarchy, shared identity layout, focus/keyboard/touch, empty/loading/error/reload and preserved local data. Do not infer availability or recording identity from appearance. Report untested interactions as untested. Screenshot and runtime evidence must refer to the same revision.

## Conservative matching and saved evidence (rules 5)

Exact/ISRC matching stays separate from conservative candidate recovery. A missing artist, known soundtrack subtitle difference, explicit version difference or duration conflict must lead to review, never title-only ownership confirmation. XML duration is retained locally; Spotify duration is used only when supplied. Equal duration is not identity proof. Duration is not guessed when a provider omits it. The legacy Python corpus is still checked against the core against its original metadata corpus; separate regression cases verify version-5 recovery and its safety boundaries.

Older absent snapshots require a recheck under the new rules. Saved queues keep an independent evidence snapshot with matching time, XML name, fingerprint and rule version. No-evidence legacy items are retained with a warning. Newer results are distinguished from saved decisions; a change in the current library does not silently rewrite the saved snapshot or delete queued tracks. Queue totals and eligible purchase-plan totals are separate concepts and must be labelled accordingly.

Terminal failures leave resumable work; transient failures stay pending. Re-adding removed tracks invalidates only the corresponding Undo entries. The batch action keeps its name in enabled, disabled and saved states, with counts outside the label. Essential affiliate/scope notices stay readable; saved progress is expandable rather than a full-time banner.
