# Playlist Shopper

Check a Spotify playlist against your rekordbox XML before looking for tracks to buy.

Playlist Shopper is a focused DJ purchase-decision workflow. Paste a public Spotify playlist URL to browse and search stores. Optionally add a rekordbox XML export to check matches before making purchase decisions.

## What It Does

- Compares a Spotify playlist against a Rekordbox XML library export.
- Separates `Not in XML`, `Matches XML`, `Needs review`, and `Not checked`. XML absence is not proof of non-ownership.
- Opens available Beatport or Bandcamp links for purchase research.
- Saves purchase candidates to `Buy Later` in the browser.
- Keeps the workflow local-first in the frontend, with saved analysis snapshots capped in local storage.

## Who This Is For

- DJs preparing sets.
- DJs converting playlists into purchase lists.
- DJs checking what is already in their Rekordbox library.

## Basic Workflow

1. Paste a public Spotify playlist URL and browse it without Spotify login.
2. Optionally select a rekordbox collection XML to compare locally (it can also be added from results).
3. Review matches, absent tracks and candidates that need confirmation. Without XML, tracks remain not checked.
4. Search Beatport or Bandcamp. Search results are not verified product/version matches.
5. Add eligible XML-absent tracks individually or in bulk to Buy Later. Duplicates and saved tracks are excluded.

See [the design system](docs/DESIGN.md) for shared visual rules, component roles and responsive verification. No additional design Skill or UI library is required.

## Current MVP Scope

- Spotify playlist input.
- Rekordbox XML upload.
- Track ownership matching using the existing frontend/backend ownership logic.
- Results table with All, Not in XML, Matched / confirmed, Needs review, and Not checked filters.
- Search and basic sorting by title, artist, or album.
- CSV export for displayed results.
- Browser-local saved results and `Buy Later` queue.

## Known Limitations

- Matching depends on playlist metadata and the exported Rekordbox XML.
- Original XML files up to 50 MiB are matched locally using a Web Worker. XML and library metadata are not uploaded; the hosted transfer ceiling does not apply to local matching.
- Saved results use browser local storage and may be cleared by the browser.
- Purchase links are best-effort search or store links when available.
- Only Spotify playlist URLs are supported in the current sharing flow.

## Not Included Yet

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
5. Confirm results show `Not in XML` and `Matches XML` counts.
6. Filter between `All`, `Not in XML`, and `Matches XML`.
7. Open a Beatport or Bandcamp link when present.
8. Add a track to `Buy Later`, then remove it.
9. Export CSV for the displayed results.
10. Refresh the page and confirm saved local results restore as expected.

## Notes

- Analyzer state stores only core domain data and progress.
- Local storage persists full analysis snapshots with a 2 MiB cap. `Clear analysis history` keeps saved XML and Buy Later; their removal controls are separate.
- URL utilities live in `lib/utils/playlistUrl.ts`.
- CSV injection mitigation lives in `lib/utils/csvSanitize.ts`.
- See `docs/DISTRIBUTION.md` for packaging with `git archive`.
