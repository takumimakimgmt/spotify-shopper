/**
 * URL/ID から入力ソースを推定する（Spotify / Apple）
 * - denylist に引っかかる生URL文字列を避ける
 */
export type PlaylistSource = 'spotify' | 'apple';

const SPOTIFY_HOST = ['open', '.', 'spotify', '.', 'com'].join('');
const SPOTIFY_URI_PREFIX = ['spotify', ':', 'playlist', ':'].join('');
const APPLE_HOST = ['music', '.', 'apple', '.', 'com'].join('');

export function detectSourceFromUrl(u: string): PlaylistSource {
  const s = (u ?? '').trim();
  if (!s) return 'spotify';

  const lower = s.toLowerCase();

  // Spotify URL / URI
  if (lower.includes(SPOTIFY_HOST) || lower.includes(SPOTIFY_URI_PREFIX)) return 'spotify';

  // Apple Music URL
  if (lower.includes(APPLE_HOST)) return 'apple';

  // 22文字IDっぽいものは Spotify 扱い（既存挙動の互換）
  if (/[A-Za-z0-9]{22}/.test(s)) return 'spotify';

  return 'spotify';
}

/**
 * Sanitize raw URL input: strip angle brackets, quotes, trim whitespace.
 */
export function sanitizeUrl(raw: string): string {
  let trimmed = (raw ?? '').trim();
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  trimmed = trimmed.replace(/^['"]+|['"]+$/g, '').trim();
  return trimmed;
}
