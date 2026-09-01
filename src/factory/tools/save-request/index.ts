import { tool } from "ai";
import { z } from "zod";
import { slugSchema, writeArtifact } from "../../artifacts/store.js";

/**
 * The editor's only job at the start: record what the author actually said. The
 * reader classification that used to live here is now the 'classify' task, with
 * its own prompt and its own model — inferring an audience is judgement, and
 * judgement belongs in a prompt.md rather than in zod field descriptions.
 */
export const saveRequest = tool({
  description:
    "Run this first. Records the author's request word for word. Do not interpret, expand, or tidy it — the classify task reads this and does that work. Returns the slug to reuse for every later call.",
  inputSchema: z.object({
    slug: slugSchema,
    request: z.string().describe("The author's words, verbatim"),
  }),
  execute: async ({ slug, request }) => {
    const saved = await writeArtifact(slug, "request.md", `# Request\n\n${request}\n`);
    // Echoed back because every later tool needs it character for character, and
    // a mistyped slug means the next task cannot find its input.
    return { ...saved, reuseThisSlug: slug };
  },
});
