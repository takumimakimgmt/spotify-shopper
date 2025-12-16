export function withBeatportAid(url: string, aid?: string): string {
  const a = (aid ?? '').trim();
  if (!url || !a) return url;

  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host !== 'beatport.com') return url;

    // already has a_aid -> keep
    if (u.searchParams.get('a_aid')) return u.toString();

    u.searchParams.set('a_aid', a);
    return u.toString();
  } catch {
    // If it's not a valid absolute URL, don't touch it
    return url;
  }
}