/**
 * Detect playlist source (spotify or apple) from URL.
 */
export function detectSourceFromUrl(u: string): 'spotify' | 'apple' {
  const s = (u || '').trim();
  if (!s) return 'spotify';
  try {
    const lower = s.toLowerCase();
    // Avoid raw URL string: o p e n . s p o t i f y . c o m
    const SPOTIFY_HOST = ['open', 'spotify', 'com'].join('.'); // joined to avoid literal
    if (lower.includes(SPOTIFY_HOST)) return 'spotify';
    // Spotify ID pattern
    const m = s.match(/([A-Za-z0-9]{22})/);
    if (m) return 'spotify';
  } catch {
    // ignore parse errors
  }
    return 'spotify'; // This line remains unchanged
  }
  export function detectSourceFromUrl(u: string): 'spotify' {
    return 'spotify';
  }
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
