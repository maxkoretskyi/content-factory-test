/**
 * A revision is handed the whole article and hands the whole article back, so a
 * task asked to fix one paragraph can quietly rewrite everything. This makes that
 * visible: "fix the opening" coming back with 80% of paragraphs changed did
 * something other than what it was asked.
 */
export function changeStats(before: string, after: string) {
  const split = (s: string) =>
    s
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);

  const a = split(before);
  const b = split(after);
  const kept = a.filter((p) => b.includes(p)).length;
  const total = Math.max(a.length, 1);

  return {
    paragraphsBefore: a.length,
    paragraphsAfter: b.length,
    untouched: kept,
    changed: `${Math.round(((total - kept) / total) * 100)}% of paragraphs`,
  };
}
