import { tool } from "ai";
import { z } from "zod";
import { readArtifact, resolveSlug, slugSchema } from "../../artifacts/store.js";
import { changeStats } from "../../artifacts/diff.js";
import { runWorkflow } from "../../tasks/runtime/run.js";

/**
 * Revise then check. Verify runs every time because a revision can strand what it
 * did not touch — a deleted example still referenced two paragraphs later, a
 * pronoun whose antecedent went with the sentence that was cut.
 */
const TASKS = ["revise", "verify"] as const;

export const revise = tool({
  description:
    "Apply the author's feedback to the existing draft, then re-check that the article still holds together. Use this for anything about the prose itself — an opening that doesn't land, a passage to cut, a claim to soften, a section to expand. Pass their words, not your paraphrase of them.",
  inputSchema: z.object({
    slug: slugSchema,
    instruction: z
      .string()
      .describe(
        "What to change, in the author's own words wherever they gave them. Be specific about where: 'the opening paragraph', 'section 3', 'the Lambda example'.",
      ),
  }),
  execute: async ({ slug: given, instruction }) => {
    const resolved = resolveSlug(given);
    if (typeof resolved === "string") return resolved;
    const { slug } = resolved;

    const before = (await readArtifact(slug, "draft.md")) ?? "";
    const result = await runWorkflow(TASKS, slug, instruction);
    const after = (await readArtifact(slug, "draft.md")) ?? "";

    return typeof result === "string"
      ? result
      : { ...result, ...changeStats(before, after) };
  },
});
