> NOTE: Apple Music support is currently disabled (backend Playwright removed). Re-enable will require restoring Apple scraping strategy.

Spotify Shopper Web — Next.js frontend.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```


You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses optimized web fonts via Next.js.

## Design Decisions

- Analyzer stores only core domain + progress; localStorage persists slim summaries with a ~300KB cap, exposing warnings via `storageWarning` and reset via `clearLocalData`.
- URL utils centralized in `lib/utils/playlistUrl.ts` (`detectSourceFromUrl`, `sanitizeUrl`).
- CSV injection mitigation: `lib/utils/csvSanitize.ts` prefixes cells starting with = + - @ with `'`.

See `docs/DISTRIBUTION.md` for packaging with `git archive`.
