export function withBeatportAid(
  url: string,
  aid: string | undefined = process.env.NEXT_PUBLIC_BEATPORT_A_AID,
): string {
  const a = (aid ?? "").trim();
  if (!url || !a) return url;

  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host !== "beatport.com") return url;

    // Apply this site's configured attribution, including restored links.
    u.searchParams.set("a_aid", a);
    return u.toString();
  } catch {
    // If it's not a valid absolute URL, don't touch it
    return url;
  }
}
