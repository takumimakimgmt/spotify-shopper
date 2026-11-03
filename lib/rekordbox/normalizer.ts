import folding from "./casefold.json";
const folds = folding as Record<string, string>;
const ws = (s: string) => s.replace(/\s+/gu, " ").trim();
const dash = (s: string) => s.replace(/[—–−―]/gu, "-");
const tempo = /\s+(?:\d{2,3}(?:\.\d+)?|\d{2,3}\s*-\s*\d{2,3}(?:\.\d+)?)\s*$/u;
export const casefold = (s: string) =>
  Array.from(s, (c) => folds[c] ?? c).join("");
const word = String.raw`[\p{L}\p{N}_]`;
const boundary = (s: string, flags = "gu") =>
  new RegExp(`(?<!${word})(?:${s})(?!${word})`, flags);
const versionWords = boundary(
  "remix|mix|edit|extended|vip|dub|instrumental|acoustic|live|remaster(?:ed)?|version|clean|explicit|part|pt|sped|slowed|intro|outro|acapella|a cappella",
  "u",
);

export function normalizeArtist(name: string): string {
  let s = dash(name.toLowerCase().trim());
  for (const sep of [",", "&", " and "])
    if (s.includes(sep)) s = s.split(sep)[0].trim();
  s = s.split(/\s+(?:feat\.|ft\.|featuring)\s+/u)[0];
  return ws(s).replace(/\|/gu, "／");
}
export function normalizeTitle(title: string): string {
  let s = dash(title.toLowerCase().trim())
    .replace(/_/gu, " ")
    .replace(tempo, "");
  s = s
    .replace(/\s+master$/u, "")
    .replace(/\([^)]*\)/gu, "")
    .replace(/\[[^\]]*\]/gu, "");
  s = s.replace(/\s+(?:feat\.|ft\.|featuring)\s+.*$/u, "");
  s = s.replace(
    new RegExp(
      String.raw`\s*-\s*(?:.*${"(?<!" + word + ")"})?(original mix|extended mix|extended|radio edit|club mix|dub mix|dub|vip|edit|remix|mix)(?!${word}).*$`,
      "u",
    ),
    "",
  );
  return ws(s).replace(/\|/gu, "／");
}
export function normalizeAlbum(album: string): string {
  return ws(
    dash(album.toLowerCase().trim())
      .replace(/\([^)]*\)/gu, "")
      .replace(/\[[^\]]*\]/gu, ""),
  ).replace(/\|/gu, "／");
}
export function artistIdentity(artist: string): string[] {
  const text = casefold(artist.normalize("NFKC")).replace(/_/gu, " ");
  const separator = new RegExp(
    String.raw`\s*(?:,|&|${boundary("and", "u").source}|(?<!${word})(?:feat|ft)\.?(?=\s|$)|${boundary("featuring", "u").source})\s*`,
    "u",
  );
  return [...new Set(text.split(separator).map(ws).filter(Boolean))].sort();
}
export function versionSignature(title: string): string[] {
  const text = dash(casefold(title)).replace(/_/gu, " ").replace(tempo, "");
  const descriptors = [...text.matchAll(/\(([^)]*)\)|\[([^\]]*)\]/gu)].map(
    (m) => m[1] || m[2],
  );
  descriptors.push(
    ...text
      .replace(/\([^)]*\)|\[[^\]]*\]/gu, "")
      .split(/\s+-\s+/u)
      .slice(1),
  );
  return [
    ...new Set(
      descriptors
        .filter((s) => versionWords.test(s))
        .map((s) =>
          ws(
            s
              .replace(boundary("original\\s+mix"), "")
              .replace(boundary("extended\\s+mix"), "extended")
              .replace(boundary("remastered"), "remaster")
              .replace(boundary("and"), " ")
              .replace(/&/gu, " ")
              .replace(/[^\p{L}\p{N}_\s]/gu, " "),
          ),
        )
        .filter(Boolean),
    ),
  ].sort();
}
export function annotationSignature(title: string): string[] {
  const text = dash(casefold(title)).replace(/_/gu, " ");
  return [
    ...new Set(
      [...text.matchAll(/\(([^)]*)\)/gu)]
        .map((m) => m[1])
        .filter(
          (s) =>
            s.trim() &&
            !versionWords.test(s) &&
            !/^\s*(?:feat\.?|ft\.?|featuring)\s/u.test(s),
        )
        .map(ws),
    ),
  ].sort();
}
export function titleArtistPairs(title: string, artist: string): string[] {
  const pairs: string[] = [];
  const add = (t: string, a: string) => {
    if (t && a) {
      const key = JSON.stringify([t, a]);
      if (!pairs.includes(key)) pairs.push(key);
    }
  };
  const t = normalizeTitle(title),
    a = normalizeArtist(artist);
  add(t, a);
  if (t && a) add(t, "credits:" + JSON.stringify(artistIdentity(artist)));
  if (!a) {
    const tokens = t.split(" ").filter(Boolean);
    if (tokens.length >= 2 && tokens.length <= 6)
      for (let i = 1; i < tokens.length; i++)
        add(
          normalizeTitle(tokens.slice(i).join(" ")),
          normalizeArtist(tokens.slice(0, i).join(" ")),
        );
  }
  const embedded = title.trim().match(/^(.+?)\s*-\s*(.+)$/u);
  if (embedded)
    add(
      normalizeTitle(embedded[2].trim()),
      normalizeArtist(embedded[1].trim()),
    );
  return pairs;
}
