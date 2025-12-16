# Copilot Instructions - Spotify Playlist Shopper

## Architecture Overview

This is a **dual-stack monorepo** with separate backend and frontend:

- **Backend** (`spotify-shopper/`): Python 3.11 FastAPI service for playlist fetching & Rekordbox matching
- **Frontend** (`spotify-shopper-web/`): Next.js 15 (React 19) TypeScript app deployed on Vercel

### Data Flow
1. User enters playlist URL (Spotify or Apple Music) + optional Rekordbox XML
2. Backend fetches playlist metadata via Spotipy (Spotify) or Playwright scraping (Apple Music)
3. Backend matches tracks against Rekordbox collection using 4-tier logic (ISRC → exact → album → fuzzy)
4. Frontend displays 3-tier ownership status: 🟢 YES (confirmed), 🟡 MAYBE (fuzzy ≥0.92), ⚪️ NO (not found)

## Critical Backend Patterns

### Dual-Source Playlist Fetching (`core.py`)
- **Spotify**: Uses `spotipy` with client credentials (requires `SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET`)
- **Apple Music**: Headless Playwright scraping (`_fetch_with_playwright`) since no public API exists
  - TTL-cached (5 min) to avoid repeated renders
  - 3-attempt retry with `networkidle` wait strategy for SPA rendering stability
  - Waits for track list selectors before extracting content (30s timeout)
  - User-Agent: macOS Safari to match Apple Music's expected client
  - Handles mojibake with `_fix_mojibake()` scoring candidates for CJK correctness
  - **CRITICAL**: Apple metadata (artist/album) is **never** overwritten; Spotify only adds ISRCs

### ISRC Enrichment
- Apple tracks get read-only ISRC enrichment from Spotify via `_enrich_apple_tracks_with_spotify()`
- Original Apple artist/album/URL metadata is preserved completely

### Rekordbox Matching Logic (`rekordbox.py`)
4-tier fallback matching in `mark_owned_tracks()`:
1. **ISRC exact match** → `owned_reason: "isrc"`
2. **Normalized (title, artist)** → `owned_reason: "exact"`
   - Handles "ARTIST - TITLE" patterns via `generate_title_artist_pairs()`
3. **Normalized (title, album)** → `owned_reason: "album"` (catches katakana artist variations)
4. **Fuzzy title match** (same artist, ≥0.92 threshold) → `owned_reason: "fuzzy"`

### Normalization Functions
Key helpers in `rekordbox.py`:
- `normalize_artist()`: Lowercase, strip feat./ft., take first artist from "A & B"
- `normalize_title_base()`: Remove brackets, "(Original Mix)", feat., etc.
- `normalize_album()`: Strip "(Deluxe)", etc.

### Error Handling & i18n
- Bilingual error messages (JP/EN) for:
  - Personalized playlists (Daily Mix, On Repeat, Blend)
  - Editorial playlists (37i9ddd...)
  - Region-restricted content
- Deployment-aware errors reference Render.com-specific `SPOTIFY_MARKET` env var

## Development Workflows

### Local Backend Setup
```bash
cd spotify-shopper
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m playwright install chromium  # Critical for Apple Music scraping

export SPOTIFY_CLIENT_ID="..."
export SPOTIFY_CLIENT_SECRET="..."
uvicorn app:app --host 127.0.0.1 --port 8000
```

### Local Frontend Setup
```bash
cd spotify-shopper-web
npm install
NEXT_PUBLIC_BACKEND_URL="http://127.0.0.1:8000" npm run dev
```

### Testing Playlist Sources
- **Spotify**: Use public playlist URLs or IDs (avoid 37i9ddd editorial playlists for testing)
- **Apple Music**: Pass full `music.apple.com/jp/playlist/...` URLs
- Backend auto-detects source from URL if `source` param is omitted

## Deployment Configuration

### Backend (Render)
- Defined in `render.yaml` with Playwright browser installation in `buildCommand`
- Environment variables: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_MARKET` (default: JP,US,GB), `ALLOWED_ORIGINS`
- Health check at `/health` endpoint
- Start command: `uvicorn app:app --host 0.0.0.0 --port $PORT`

### Frontend (Vercel)
- Set `NEXT_PUBLIC_BACKEND_URL` to Render backend URL
- CORS configured via `ALLOWED_ORIGINS` in backend

## Code Conventions

### Python
- Use `from __future__ import annotations` for type hints
- FastAPI Pydantic models end with `Model` suffix (e.g., `TrackModel`, `PlaylistResponse`)
- All playlist functions return dict with keys: `playlist_id`, `playlist_name`, `playlist_url`, `tracks` (list of items)
- Track items use Spotify API shape with `track` key containing metadata

### TypeScript
- Frontend uses client-side XML parsing (`DOMParser`) for Rekordbox uploads
- Key normalization matches Python backend: `normalizeKey()` strips whitespace, NFKC normalize, lowercase
- All API calls to backend use `BACKEND_URL` constant from env var

### Integration Points
- Backend endpoints: `/api/playlist` (GET), `/api/playlist-with-rekordbox-upload` (POST multipart)
- Frontend uploads Rekordbox XML as `FormData` with `url`, `source`, and `file` fields
- Max upload size: 5MB (configurable via `MAX_UPLOAD_SIZE` env var)
