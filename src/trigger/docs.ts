import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { tool } from "ai";
import { z } from "zod";

/**
 * Ground truth: the Trigger.dev docs shipped inside the installed SDK. Version-matched
 * to the code we actually depend on, and available with no network call.
 */
const CORPUS = resolve(process.cwd(), "node_modules/@trigger.dev/sdk/docs");

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.name.endsWith(".mdx") || e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

export const searchDocs = tool({
  description:
    "Search the official Trigger.dev docs for a term. Returns matching files with the surrounding line, so you can quote real API signatures instead of recalling them.",
  inputSchema: z.object({
    query: z.string().describe("A literal term: an export name, option, or phrase. e.g. 'chat.agent' or 'idleTimeoutInSeconds'"),
    limit: z.number().int().min(1).max(40).default(15),
  }),
  execute: async ({ query, limit }) => {
    const needle = query.toLowerCase();
    const hits: { file: string; line: number; text: string }[] = [];
    for (const f of await walk(CORPUS)) {
      const lines = (await readFile(f, "utf8")).split("\n");
      lines.forEach((text, i) => {
        if (hits.length < limit && text.toLowerCase().includes(needle)) {
          hits.push({ file: relative(CORPUS, f), line: i + 1, text: text.trim().slice(0, 200) });
        }
      });
      if (hits.length >= limit) break;
    }
    return hits.length ? { query, hits } : { query, hits: [], note: "No matches. The term may not exist in this version of the SDK." };
  },
});

export const readDoc = tool({
  description: "Read a docs file found via searchDocs. Use it to check an API's real shape before writing about it.",
  inputSchema: z.object({
    file: z.string().describe("Path relative to the docs root, as returned by searchDocs"),
    maxChars: z.number().int().min(500).max(20000).default(8000),
  }),
  execute: async ({ file, maxChars }) => {
    const target = resolve(CORPUS, file);
    if (relative(CORPUS, target).startsWith("..")) return { error: "Outside the docs corpus." };
    const body = await readFile(target, "utf8").catch(() => null);
    if (body === null) return { error: `No such doc: ${file}` };
    return { file, content: body.slice(0, maxChars), truncated: body.length > maxChars };
  },
});

export const groundingTools = { searchDocs, readDoc };
