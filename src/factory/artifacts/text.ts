/** Pure helpers over artifact text. No filesystem, no schemas. */

export const countWords = (s: string) => s.split(/\s+/).filter(Boolean).length;

export function renderJson(body: string) {
  const data = JSON.parse(body) as Record<string, unknown>;
  const heading = (k: string) =>
    k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

  const out: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    out.push(`## ${heading(key)}`, "");
    if (Array.isArray(value)) out.push(...value.map((v) => `- ${String(v)}`));
    else out.push(String(value));
    out.push("");
  }
  return out.join("\n").trim();
}
