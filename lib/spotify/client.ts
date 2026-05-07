"use client";

const AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const PLAYLISTS_URL = "https://api.spotify.com/v1/me/playlists";

const SPOTIFY_SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative",
] as const;

const STORAGE_KEYS = {
  verifier: "spotify-pkce-verifier",
  state: "spotify-auth-state",
  session: "spotify-auth-session",
} as const;

export type SpotifyPlaylistSummary = {
  id: string;
  name: string;
  url: string;
  ownerName: string;
  imageUrl: string | null;
  trackCount: number;
};

type SpotifyTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
};

type SpotifyAuthSession = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
};

type SpotifyPlaylistApiResponse = {
  items?: Array<{
    id?: string | null;
    name?: string | null;
    external_urls?: { spotify?: string | null } | null;
    owner?: { display_name?: string | null } | null;
    images?: Array<{ url?: string | null }> | null;
    tracks?: { total?: number | null } | null;
  }>;
  next?: string | null;
};

function getClientId() {
  return (process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? "").trim();
}

function getRedirectUri() {
  const configured = (
    process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI ?? ""
  ).trim();
  if (configured) return configured;
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/`;
}

function assertBrowser() {
  if (typeof window === "undefined") {
    throw new Error("Spotify auth is only available in the browser.");
  }
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function randomString(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes).slice(0, length);
}

async function createCodeChallenge(verifier: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64UrlEncode(new Uint8Array(digest));
}

function savePkceContext(verifier: string, state: string) {
  sessionStorage.setItem(STORAGE_KEYS.verifier, verifier);
  sessionStorage.setItem(STORAGE_KEYS.state, state);
}

function readPkceContext() {
  return {
    verifier: sessionStorage.getItem(STORAGE_KEYS.verifier),
    state: sessionStorage.getItem(STORAGE_KEYS.state),
  };
}

function clearPkceContext() {
  sessionStorage.removeItem(STORAGE_KEYS.verifier);
  sessionStorage.removeItem(STORAGE_KEYS.state);
}

function saveSession(session: SpotifyAuthSession) {
  sessionStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
}

function readSession(): SpotifyAuthSession | null {
  const raw = sessionStorage.getItem(STORAGE_KEYS.session);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SpotifyAuthSession>;
    if (
      typeof parsed.accessToken === "string" &&
      typeof parsed.expiresAt === "number"
    ) {
      return {
        accessToken: parsed.accessToken,
        refreshToken:
          typeof parsed.refreshToken === "string" ? parsed.refreshToken : null,
        expiresAt: parsed.expiresAt,
      };
    }
  } catch {}
  return null;
}

function clearSession() {
  sessionStorage.removeItem(STORAGE_KEYS.session);
}

function tokenFromResponse(
  json: SpotifyTokenResponse,
  priorRefreshToken?: string | null,
) {
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? priorRefreshToken ?? null,
    expiresAt: Date.now() + Math.max(0, json.expires_in - 30) * 1000,
  };
}

async function fetchToken(params: URLSearchParams) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Spotify token exchange failed.");
  }

  return (await response.json()) as SpotifyTokenResponse;
}

async function ensureFreshSession() {
  assertBrowser();
  const clientId = getClientId();
  if (!clientId) return null;

  const current = readSession();
  if (!current) return null;
  if (Date.now() < current.expiresAt) return current;
  if (!current.refreshToken) {
    clearSession();
    return null;
  }

  const json = await fetchToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: current.refreshToken,
      client_id: clientId,
    }),
  );
  const next = tokenFromResponse(json, current.refreshToken);
  saveSession(next);
  return next;
}

export function isSpotifyAuthConfigured() {
  return Boolean(getClientId());
}

export function getSpotifyAuthScopes() {
  return [...SPOTIFY_SCOPES];
}

export async function beginSpotifyLogin() {
  assertBrowser();
  const clientId = getClientId();
  const redirectUri = getRedirectUri();

  if (!clientId) {
    throw new Error("Missing NEXT_PUBLIC_SPOTIFY_CLIENT_ID.");
  }
  if (!redirectUri) {
    throw new Error("Missing Spotify redirect URI.");
  }

  const verifier = randomString(64);
  const state = randomString(24);
  const challenge = await createCodeChallenge(verifier);
  savePkceContext(verifier, state);

  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", SPOTIFY_SCOPES.join(" "));
  window.location.assign(url.toString());
}

export async function completeSpotifyLoginFromUrl(urlString: string) {
  assertBrowser();
  const url = new URL(urlString);
  const error = url.searchParams.get("error");
  if (error) {
    clearPkceContext();
    throw new Error(`Spotify authorization failed: ${error}`);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code) return null;

  const clientId = getClientId();
  const redirectUri = getRedirectUri();
  const pkce = readPkceContext();
  if (!clientId || !redirectUri || !pkce.verifier || !pkce.state) {
    throw new Error(
      "Spotify login session is missing. Please try connecting again.",
    );
  }
  if (state !== pkce.state) {
    clearPkceContext();
    throw new Error(
      "Spotify login state mismatch. Please try connecting again.",
    );
  }

  const json = await fetchToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: pkce.verifier,
    }),
  );

  clearPkceContext();
  const session = tokenFromResponse(json);
  saveSession(session);

  url.searchParams.delete("code");
  url.searchParams.delete("state");
  url.searchParams.delete("error");
  window.history.replaceState({}, "", url.toString());
  return session;
}

export async function getSpotifySession() {
  return ensureFreshSession();
}

export function logoutSpotify() {
  if (typeof window === "undefined") return;
  clearPkceContext();
  clearSession();
}

export async function fetchCurrentUserPlaylists() {
  const session = await ensureFreshSession();
  if (!session) {
    throw new Error("Connect Spotify to load your playlists.");
  }

  const playlists: SpotifyPlaylistSummary[] = [];
  let nextUrl: string | null = `${PLAYLISTS_URL}?limit=50`;
  let pageCount = 0;

  while (nextUrl && pageCount < 20) {
    const response = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    if (response.status === 401) {
      clearSession();
      throw new Error("Spotify session expired. Please connect again.");
    }
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Failed to load Spotify playlists.");
    }

    const json = (await response.json()) as SpotifyPlaylistApiResponse;
    for (const item of json.items ?? []) {
      const id = item.id?.trim();
      const url = item.external_urls?.spotify?.trim();
      if (!id || !url) continue;
      playlists.push({
        id,
        name: item.name?.trim() || "Untitled playlist",
        url,
        ownerName: item.owner?.display_name?.trim() || "Spotify user",
        imageUrl: item.images?.[0]?.url?.trim() || null,
        trackCount: item.tracks?.total ?? 0,
      });
    }

    nextUrl = json.next ?? null;
    pageCount += 1;
  }

  return playlists;
}
