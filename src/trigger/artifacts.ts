import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";

/**
 * Artifacts live on the machine running the turn. In dev that's this repo, which
 * is what we want — the article is a deliverable. On a deployed run they'd live
 * in the container and survive the conversation but not outlive it.
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

/** Every draft write is snapshotted, so revisions leave a before/after trail. */
export async function snapshotDraft(slug: string, body: string, note: string) {
  const revisions = join(dir(slug), "revisions");
  await mkdir(revisions, { recursive: true });
  const n = String((await readdir(revisions)).length + 1).padStart(2, "0");
  await writeFile(join(revisions, `${n}.md`), `<!-- ${note} -->\n${body}`, "utf8");
  const saved = await writeArtifact(slug, "draft.md", body);
  return { ...saved, revision: n, note };
}

export const countWords = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** Stage gating: a missing input artifact fails loudly instead of being invented. */
export function missing(name: string, stage: string) {
  return `Cannot run this stage: ${name} does not exist yet. Run the ${stage} stage first.`;
}
