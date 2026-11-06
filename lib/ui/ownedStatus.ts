/**
 * Get visual styling for track ownership status
 */
export function getOwnedStatusStyle(
  owned: boolean | null | undefined,
  ownedReason: string | null | undefined,
): { borderClass: string; tooltip: string } {
  if (owned === true) {
    const tooltip =
      ownedReason === "isrc"
        ? "✅ Matches XML: Matched by ISRC"
        : ownedReason === "exact"
          ? "✅ Matches XML: Matched by Title + Artist"
          : ownedReason === "album"
            ? "✅ Matches XML: Matched by Title + Album"
            : ownedReason === "fuzzy"
              ? "🟠 Maybe: Fuzzy match (low confidence)"
              : "✅ Matches XML";
    return {
      borderClass: "border-l-4 border-emerald-500",
      tooltip,
    };
  }
  if (owned == null) {
    return {
      borderClass: "border-l-4 border-amber-500",
      tooltip: "Needs review: Check the recording with XML",
    };
  }
  return {
    borderClass: "border-l-4 border-slate-600",
    tooltip: "Not found in this XML; ownership outside this export is unknown",
  };
}
