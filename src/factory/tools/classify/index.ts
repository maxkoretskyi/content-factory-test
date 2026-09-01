import { tool } from "ai";
import { z } from "zod";
import { slugSchema } from "../../artifacts/store.js";
import { runWorkflow } from "../../tasks/runtime/run.js";

/** The tasks this tool runs, in order. */
const TASKS = ["classify"] as const;

export const classify = tool({
  description:
    "Work out who the article is for. Reads request.md and writes brief.json: audience, what they already know, what sends them looking now, what they should be able to decide, and the terms they would search for. Run this before find-angle and show the author what it decided — a wrong reader is inherited by everything after it.",
  inputSchema: z.object({
    slug: slugSchema,
    instruction: z
      .string()
      .optional()
      .describe("A correction from the author, e.g. a different audience or situation"),
  }),
  execute: ({ slug, instruction }) => runWorkflow(TASKS, slug, instruction),
});
