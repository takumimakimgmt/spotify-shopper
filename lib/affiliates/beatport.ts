// Values from the account's official Beatport Store deeplink generator.
export const BEATPORT_TRACKING_URL =
  "https://pluginboutique.postaffiliatepro.com/scripts/hfwq3c89wu2";
export const BEATPORT_CAMPAIGN_ID = "0be88686";

/** Accept Beatport destinations and our exact tracker, never arbitrary redirects. */
export function beatportDestination(raw: string): URL | null {
  try {
    let url = new URL(raw);
    if (url.username || url.password) return null;
    if (
      url.origin === new URL(BEATPORT_TRACKING_URL).origin &&
      url.pathname === new URL(BEATPORT_TRACKING_URL).pathname
    ) {
      url = new URL(url.searchParams.get("desturl") || "");
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !["beatport.com", "www.beatport.com"].includes(url.hostname)
    )
      return null;
    return url;
  } catch {
    return null;
  }
}

export function withBeatportAid(
  url: string,
  aid: string | undefined = process.env.NEXT_PUBLIC_BEATPORT_A_AID,
): string {
  const affiliateId = (aid ?? "").trim();
  if (!url || !affiliateId) return url;
  const destination = beatportDestination(url);
  if (!destination) return url;

  // Attribution belongs to the tracker; do not nest trackers on restored links.
  for (const key of ["a_aid", "a_cid", "a_bid"]) {
    destination.searchParams.delete(key);
  }
  const tracking = new URL(BEATPORT_TRACKING_URL);
  tracking.searchParams.set("a_aid", affiliateId);
  tracking.searchParams.set("desturl", destination.toString());
  tracking.searchParams.set("a_cid", BEATPORT_CAMPAIGN_ID);
  return tracking.toString();
}
