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
        ? "✅ Owned: Matched by ISRC"
        : ownedReason === "exact"
          ? "✅ Owned: Matched by Title + Artist"
          : ownedReason === "album"
            ? "✅ Owned: Matched by Title + Album"
            : ownedReason === "fuzzy"
              ? "🟠 Maybe: Fuzzy match (low confidence)"
              : "✅ Owned";
    return {
      borderClass: "border-l-4 border-emerald-500",
      tooltip,
    };
  }
  if (owned == null) {
    return {
      borderClass: "border-l-4 border-amber-500",
      tooltip: "Unverified: Check ownership with XML",
    };
  }
  return {
    borderClass: "border-l-4 border-slate-600",
    tooltip: "⬛ To Buy: Not found in library",
  };
}
