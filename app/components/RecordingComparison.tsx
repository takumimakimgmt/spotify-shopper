import type { PlaylistRow } from "@/lib/types";

function normal(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
/** Highlight differing words for inspection; never use this display diff to decide ownership. */
function Difference({ value, other }: { value: string; other: string }) {
  const words = new Set(normal(other).split(/\s+/));
  return (
    <>
      {value.split(/(\s+)/).map((word, i) =>
        words.has(normal(word)) || !word.trim() ? (
          <span key={i}>{word}</span>
        ) : (
          <mark key={i} className="rounded bg-amber-300/20 text-amber-100">
            {word}
          </mark>
        ),
      )}
    </>
  );
}
export default function RecordingComparison({ track }: { track: PlaylistRow }) {
  const candidate = track.libraryMatch;
  if (!candidate?.matched_title) return null;
  const fields = [
    ["Title / version", track.title, candidate.matched_title],
    ["Artist credits", track.artist, candidate.matched_artist || ""],
  ];
  return (
    <div className="mt-3 space-y-2 break-words">
      <p className="font-medium text-slate-100">Compare recordings</p>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {["Spotify recording", "XML candidate"].map((label, side) => (
          <div
            key={label}
            className="min-w-0 rounded border border-white/15 p-2"
          >
            <p className="mb-2 font-semibold">{label}</p>
            {fields.map(([name, left, right]) => (
              <div key={name} className="mb-2">
                <p className="text-slate-400">
                  {name}
                  {normal(left) !== normal(right) ? " · differs" : ""}
                </p>
                <p>
                  {(side ? right : left) ? (
                    <Difference
                      value={side ? right : left}
                      other={side ? left : right}
                    />
                  ) : (
                    "Not supplied"
                  )}
                </p>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="text-slate-400">
        Highlighted words differ. Check the full mix / remix name and artist
        credits. XML candidate album and ISRC are not available in this
        comparison.
      </p>
      {track.isrc && <p>Spotify ISRC: {track.isrc}</p>}
    </div>
  );
}
