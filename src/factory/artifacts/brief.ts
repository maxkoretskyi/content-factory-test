import { z } from "zod";
import { readArtifact } from "./store.js";

/**
 * The shape of articles/<slug>/brief.json.
 *
 * One definition, two jobs: it validates what the editor writes (as saveBrief's
 * input schema) and types what reads it back. The fields are a classification of
 * the reader, deliberately — asked for "intent" as free prose, the editor wrote
 * the article's conclusion into it, and research inherited the answer it was
 * supposed to go and find. There is no field here a conclusion fits into.
 */
export const BriefSchema = z.object({
  brief: z.string().describe("The brief exactly as the author gave it. Do not rewrite or expand it."),

  audience: z
    .string()
    .describe(
      "Who exactly. A role plus a situation — 'backend engineers who have shipped an LLM feature and hit a timeout', not 'developers'.",
    ),
  assumedKnowledge: z
    .array(z.string())
    .describe("What this reader already knows, so the article does not explain it back to them"),
  trigger: z
    .string()
    .describe("What makes them look for this now — the moment, error, or decision that sends them searching"),
  decision: z
    .string()
    .describe(
      "What they should be able to decide or judge afterwards that they could not before. A decision, not 'understand X'.",
    ),
  searchTerms: z
    .array(z.string())
    .min(3)
    .describe(
      "What this reader would actually type into a search box, in their words including the wrong ones. " +
        "These seed the research task. They are the reader's question, never the answer — no solution names, no product names.",
    ),
  constraints: z
    .array(z.string())
    .optional()
    .describe("Only what the author stated: length, must-cover, must-avoid. Never invent one."),
});

export type Brief = z.infer<typeof BriefSchema>;

/** Typed read, for anything that needs the fields rather than the prose rendering. */
export async function readBrief(slug: string): Promise<Brief | null> {
  const body = await readArtifact(slug, "brief.json");
  return body === null ? null : BriefSchema.parse(JSON.parse(body));
}
