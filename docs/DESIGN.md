# Playlist Shopper design system

## Product and scope

A PC-first DJ purchase research tool: public Spotify playlist → optional local rekordbox XML comparison → review tracks → Beatport search or product link → browser-local Buy Later. Bandcamp is secondary. XML absence never proves global non-ownership. Saved candidates still require the existing absence result; this design pass does not broaden eligibility, modify matching, or verify store availability/version.

## Direction

Carry the existing social cover's bold type, dark ground, off-white text and restrained green groove accent into the input view. Keep long result lists quiet. Do not add decorative imagery, autoplay, new fonts, UI libraries, paid services or tracking to create personality.

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
