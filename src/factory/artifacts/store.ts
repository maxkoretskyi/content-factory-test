import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import { countWords } from "./text.js";

/**
 * Artifacts live on the machine running the turn. In dev that's this repo, which
 * is what we want — the article is a deliverable. On a deployed run they'd live in
 * the container and survive the conversation, but not outlive it.
 */
export const ARTICLES = resolve(process.cwd(), "articles");

export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "kebab-case only, e.g. 'durable-chat-agents'")
  .describe("kebab-case id for the article, stable for the whole conversation");

export const dir = (slug: string) => join(ARTICLES, slug);
const path = (slug: string, name: string) => join(dir(slug), name);

export async function readArtifact(slug: string, name: string): Promise<string | null> {
  const p = path(slug, name);
  return existsSync(p) ? readFile(p, "utf8") : null;
}

export async function writeArtifact(slug: string, name: string, body: string) {
  await mkdir(dir(slug), { recursive: true });
  await writeFile(path(slug, name), body, "utf8");
  return { saved: `articles/${slug}/${name}`, words: countWords(body) };
}

/**
 * Every draft write is snapshotted and named for the task that made it, so the
 * directory listing reads as the article's history: 01-enrich, 02-verify,
 * 03-compress. Diffing two adjacent files shows exactly what a task did.
 */
export async function snapshotDraft(slug: string, body: string, task: string, note: string) {
  const revisions = join(dir(slug), "revisions");
  await mkdir(revisions, { recursive: true });
  const n = String((await readdir(revisions)).length + 1).padStart(2, "0");
  const name = `${n}-${task}.md`;
  await writeFile(join(revisions, name), `<!-- ${note} -->\n${body}`, "utf8");
  const saved = await writeArtifact(slug, "draft.md", body);
  return { ...saved, revision: name, note };
}

/** A task's reasoning, kept apart from its output. Numbered so a task that runs
 *  twice leaves two records rather than one overwrite. */
export async function writeAnalysis(slug: string, task: string, body: string) {
  const folder = join(dir(slug), "analysis");
  await mkdir(folder, { recursive: true });
  const existing = (await readdir(folder)).filter((f) => f.startsWith(task + "-"));
  const name = `${task}-${String(existing.length + 1).padStart(2, "0")}.md`;
  await writeFile(join(folder, name), body, "utf8");
  return `articles/${slug}/analysis/${name}`;
}

/**
 * Sections are written as they are produced, so a task that dies on section four
 * does not throw away the three already paid for. Keyed by index and heading: if
 * the plan changes, the key changes and the stale section is not reused.
 */
export async function writeSection(slug: string, index: number, key: string, body: string) {
  const folder = join(dir(slug), "sections");
  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, sectionName(index, key)), body, "utf8");
}

export async function readSection(slug: string, index: number, key: string) {
  const p = join(dir(slug), "sections", sectionName(index, key));
  return existsSync(p) ? readFile(p, "utf8") : null;
}

const sectionName = (index: number, key: string) =>
  `${String(index + 1).padStart(2, "0")}-${key}.md`;

/** Filename-safe key from a heading, so a changed heading invalidates its section. */
export const sectionKey = (heading: string) =>
  heading
    .replace(/^#+\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "section";

/** Slugs that already have a directory. Used to make a typo self-correcting. */
export function existingSlugs(): string[] {
  if (!existsSync(ARTICLES)) return [];
  return readdirSync(ARTICLES, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}
