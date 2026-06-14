# Playlist Shopper

Find the tracks in your Spotify playlists that are missing from your Rekordbox library.

Playlist Shopper is a focused DJ purchase-decision workflow. Upload a Rekordbox XML export, paste a Spotify playlist URL, and review which tracks you already own and which tracks you still need to buy.

## What It Does

- Compares a Spotify playlist against a Rekordbox XML library export.
- Splits results into `To buy` and `Owned`.
- Opens available Beatport or Bandcamp links for purchase research.
- Saves purchase candidates to `Buy Later` in the browser.
- Keeps the workflow local-first in the frontend, with saved analysis summaries capped in local storage.

## Who This Is For

- DJs preparing sets.
- DJs converting playlists into purchase lists.
- DJs checking what is already in their Rekordbox library.

## Basic Workflow

1. Export Rekordbox XML.
2. Upload the XML file.
3. Paste a Spotify playlist URL.
4. Analyze.
5. Review `To buy` and `Owned`.
6. Open Beatport or Bandcamp, or save tracks to `Buy Later`.

## Current MVP Scope

- Spotify playlist input.
- Rekordbox XML upload.
- Track ownership matching using the existing frontend/backend ownership logic.
- Results table with `All`, `To buy`, and `Owned` filters.
- Search and basic sorting by title, artist, or album.
- CSV export for displayed results.
- Browser-local saved results and `Buy Later` queue.

## Known Limitations

- Matching depends on playlist metadata and the exported Rekordbox XML.
- Large XML files are limited to 50 MB in the frontend.
- Saved results use browser local storage and may be cleared by the browser.
- Purchase links are best-effort search or store links when available.
- Only Spotify playlist URLs are supported in the current sharing flow.

## Not Included Yet

- Beatport affiliate links.
- Apple Music.
- Discogs.
- BPM/Key.
- Advanced library management.

## Local Development

Install dependencies:

```bash
pnpm install
```

Run the development server:

```bash
pnpm dev
```

Run validation:

```bash
pnpm test
pnpm exec tsc --noEmit --incremental false
pnpm lint
pnpm build
git diff --check
```

Other useful commands:

```bash
pnpm test:watch
pnpm start
pnpm api:sync
```

## Environment Variables

See `.env.example` and `docs/env-contract.md`.

- `NEXT_PUBLIC_API_BASE_URL`: public backend API base URL.

The proxy also recognizes `BACKEND_URL`, `NEXT_PUBLIC_BACKEND_URL`, and `API_BASE_URL`; `BACKEND_URL` is the recommended server-side name when available.

## Production Smoke Test Checklist

After deployment:

1. Open the production URL.
2. Upload a valid Rekordbox XML export.
3. Paste a Spotify playlist URL.
4. Run analysis and confirm progress completes.
5. Confirm results show `To buy` and `Owned` counts.
6. Filter between `All`, `To buy`, and `Owned`.
7. Open a Beatport or Bandcamp link when present.
8. Add a track to `Buy Later`, then remove it.
9. Export CSV for the displayed results.
10. Refresh the page and confirm saved local results restore as expected.

## Notes

- Analyzer state stores only core domain data and progress.
- Local storage persists slim summaries with a size cap and exposes reset through `Clear saved data`.
- URL utilities live in `lib/utils/playlistUrl.ts`.
- CSV injection mitigation lives in `lib/utils/csvSanitize.ts`.
- See `docs/DISTRIBUTION.md` for packaging with `git archive`.
