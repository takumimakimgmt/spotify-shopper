/** SequenceMatcher(None, a, b) ratio, including Python's >=200-character autojunk rule. */
export function similarity(
  left: string,
  right: string,
  deadline = Infinity,
): number {
  const a = Array.from(left),
    b = Array.from(right);
  if (!a.length && !b.length) return 1;
  const positions = new Map<string, number[]>();
  b.forEach((c, j) => {
    const list = positions.get(c) || [];
    list.push(j);
    positions.set(c, list);
  });
  if (b.length >= 200)
    for (const [c, list] of positions)
      if (list.length > Math.floor(b.length / 100) + 1) positions.delete(c);
  function longest(
    alo: number,
    ahi: number,
    blo: number,
    bhi: number,
  ): [number, number, number] {
    let besti = alo,
      bestj = blo,
      size = 0;
    let old = new Map<number, number>();
    for (let i = alo; i < ahi; i++) {
      if (i % 64 === 0 && Date.now() > deadline)
        throw new Error("Local matching exceeded its time budget.");
      const next = new Map<number, number>();
      for (const j of positions.get(a[i]) || []) {
        if (j < blo) continue;
        if (j >= bhi) break;
        const k = (old.get(j - 1) || 0) + 1;
        next.set(j, k);
        if (k > size) {
          besti = i - k + 1;
          bestj = j - k + 1;
          size = k;
        }
      }
      old = next;
    }
    while (besti > alo && bestj > blo && a[besti - 1] === b[bestj - 1]) {
      besti--;
      bestj--;
      size++;
    }
    while (
      besti + size < ahi &&
      bestj + size < bhi &&
      a[besti + size] === b[bestj + size]
    )
      size++;
    return [besti, bestj, size];
  }
  const pending: Array<[number, number, number, number]> = [
    [0, a.length, 0, b.length],
  ];
  let matches = 0;
  while (pending.length) {
    const [alo, ahi, blo, bhi] = pending.pop()!;
    const [i, j, size] = longest(alo, ahi, blo, bhi);
    if (!size) continue;
    matches += size;
    if (alo < i && blo < j) pending.push([alo, i, blo, j]);
    if (i + size < ahi && j + size < bhi)
      pending.push([i + size, ahi, j + size, bhi]);
  }
  return (2 * matches) / (a.length + b.length);
}
