/**
 * Detect playlist source (spotify or apple) from URL.
 */
export function detectSourceFromUrl(u: string): 'spotify' | 'apple' {
  const s = (u || '').trim();
  if (!s) return 'spotify';
  try {
    const lower = s.toLowerCase();
    if (lower.includes('music.apple.com')) return 'apple';
    if (lower.includes('open.spotify.com')) return 'spotify';
    // Spotify ID pattern
    const m = s.match(/([A-Za-z0-9]{22})/);
    if (m) return 'spotify';
  } catch {
    // ignore parse errors
  }
  return 'spotify';
}

/**
 * Sanitize raw URL input: strip angle brackets, quotes, trim whitespace.
 */
export function sanitizeUrl(raw: string): string {
  let trimmed = raw.trim();
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  trimmed = trimmed.replace(/^['"]+|['"]+$/g, '').trim();
  return trimmed;
}
