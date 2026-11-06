# Spotify connection and deployment

Reviewed 2026-11-05. App identity: Playlist Shopper, identified by the owner after comparing dashboard settings. Production Client ID values have not been independently read.

## Public playlist path (verified 2026-11-06)

The existing production Client Credentials path successfully returned 57 and 5 tracks for two public playlists with no visitor login, cookies, or allowlist entry. The five-user limit below applies to authenticated user connections; it must not be described as a five-visitor limit on the existing anonymous path. This observation does not prove access to every public playlist or future provider availability, and does not itself establish commercial approval.

GET /api/playlist tries the public backend first, including for visitors with Spotify cookies. Only a classified access failure plus a valid visitor session can invoke the private user path. Public proxy requests strip visitor cookies and Authorization. Rate limits or configuration errors do not trigger credential fallback.

## Authenticated user access limits

Official sources:

- https://developer.spotify.com/documentation/web-api/concepts/quota-modes
- https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security
- https://developer.spotify.com/documentation/web-api/references/changes/february-2026
- https://developer.spotify.com/documentation/web-api/reference/get-playlists-items
- https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
- https://developer.spotify.com/documentation/web-api/concepts/redirect_uri

Current Development Mode rules require a Premium app owner and up to five allowlisted authenticated users. Existing apps can have grandfathered exceptions; confirm actual dashboard limits. A successful OAuth login does not remove these restrictions. Development Mode is intended for personal/non-commercial experimentation, not as the basis for scaling a business. Affiliate-supported public use requires clarification with Spotify and appropriate access approval; this change does not obtain that approval or change the app's quota mode.

Current playlist-items endpoint is `/v1/playlists/{id}/items` with pages of at most 50 items. It is restricted to playlists the current user owns or collaborates on; public visibility alone does not guarantee access. The authenticated flow uses this endpoint and never falls back to another user's credentials after a 403. The existing unauthenticated Render path is retained for current integrations; it remains subject to Spotify's access rules and uses the legacy SDK path. Changing Client ID or adding users is not a quota workaround.

## Enable the optional connection

1. In Spotify Developer Dashboard → **Playlist Shopper** → Settings, register exactly:
   `https://www.playlistshopper.com/api/spotify/callback`
2. In Users Management, allowlist the intended testers. Check owner Premium eligibility.
3. In Vercel project **playlist-shopper-frontend**, set Production server-only variables:
   - `SPOTIFY_CLIENT_ID`: same app's public Client ID as Render (not its secret).
   - `SPOTIFY_REDIRECT_URI`: exact callback above.
   - `SPOTIFY_SESSION_SECRET`: generate at least 32 random characters using a password manager (unique to this deployment; do not paste in chat).
4. Redeploy after setting values. The connection UI remains hidden and login fails closed until all settings are valid. Use separate values and registered callbacks for Preview; no wildcard or localhost callbacks. Local development may use `http://127.0.0.1:3000/api/spotify/callback`.
5. On the production canonical domain, connect an allowlisted test account and confirm one private playlist it owns. Verify page two with a playlist over 50 tracks, denial for another user's playlist, permission denial, expiry and disconnect. No real-account OAuth has been completed during implementation.

## Security and storage

- Authorization Code with PKCE S256 and random state. Ten-minute encrypted HttpOnly transaction cookie; callback validates state and expiry before exchanging code. Fixed configured callback/home destination, no arbitrary return URL.
- Access token lives only in an authenticated AES-256-GCM encrypted HttpOnly, SameSite=Lax, Secure (HTTPS) cookie, bound to app ID and cookie purpose. Session lasts no longer than token expiry or one hour. No refresh token is retained; reconnect after expiry. Rotating the encryption secret invalidates sessions.
- Tokens never enter JSON API responses, localStorage, saved analyses, backend logs, or Render. Vercel reads authenticated playlists directly from fixed Spotify API paths. Responses are private/no-store with no shared playlist cache.
- Only playlist-read-private and playlist-read-collaborative scopes. No email/profile permission and no write scopes. Logout requires same-origin POST and clears both cookies; saved track analyses remain on the user's browser and can be removed using existing local-data controls.
- A 401 clears the session; 403 and 404 retain ambiguity (allowlist, quota mode, ownership, private/deleted playlist). Do not claim certainty about provider error causes. A 429 carries bounded Retry-After. Provider response text and tokens are never shown in public errors.

## Backend environment

On Render, or with APP_ENV=production/prod/staging, local dotenv files are not loaded. In local development, explicit process variables take precedence, then `.env.local`, then `.env`. Set Render's SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET explicitly before deployment; do not rely on uploaded dotenv files.

## Verification status

Mocked tests cover OAuth/PKCE state and expiry, cookie tampering/purpose isolation, minimum scopes, session redaction, same-origin logout, authenticated pagination, cross-user isolation, no partial success after provider failure, and stable public errors. Live Spotify account login, real private playlist retrieval, actual user allowlist, app-mode exceptions and general-public commercial approval require dashboard/account access and remain unverified.
