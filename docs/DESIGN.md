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

TrackPresentation: identity/listening/store links. ResultsTable: desktop/mobile arrangement, status, evidence and pagination. ResultsSearchTools: shared controlled search/sort for desktop and mobile. BuyLaterDrawer/Panel: native modal and queue presentation. ResultSummaryBar: state counts. ProcessingBar: indeterminate network activity vs real bounded match progress.

Native dialog/shadow/backdrop and technical detail text are intentional exceptions to ordinary flat rows. Existing .ps-\* utilities remain compatibility aliases; do not create a second design vocabulary. Use ps-action-primary/secondary for shared actions. New components should adopt semantic tokens rather than hardcoded surface/text colors.

## Motion and verification

Use short feedback transitions; no staggered row entrances. Respect prefers-reduced-motion for pulse, transitions and smooth scrolling. Progress exposes an accessible name and determinate values only when known.

Check 320/390/768/1024/1440px; Japanese and English; long remixes and multiple artist credits; no XML, matched, absent, review; empty results; storage error; queue duplicate counts and all-page saving; focus, Escape, pagination/search and CSV. Preserve local XML privacy and original metadata. Match accuracy, purchase conversions and actual large-file performance require separate validation.

## Finishing rules

Keep the listening control in its own column beside the entire track identity, never in the title row: the 44px target must not create a gap between title and artist. Desktop results have three columns (track, store, save); status and evidence toggle belong beneath the identity. Saved rows use quiet text/checks, not repeated disabled action buttons. When the filtered set is fully saved, show one count plus a link opening the shared saved list; hide redundant completion/exclusion explanations. Before saving, exclusion counts remain available in a disclosure. Selected XML uses a compact metadata/change/remove row; optional upload instructions are for the unselected state. Privacy/scope warnings and errors remain available in both states.
