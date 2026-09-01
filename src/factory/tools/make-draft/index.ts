import { tool } from "ai";
import { z } from "zod";
import { slugSchema } from "../../artifacts/store.js";
import { runWorkflow } from "../../tasks/runtime/run.js";

/** The tasks this tool runs, in order. */
const TASKS = ["plan", "enrich", "compress", "verify"] as const;

export const makeDraft = tool({
  description:
    "Write the article: plan, enrich, compress, verify — in one call. Use once the author has chosen an angle. Requires brief.json and research.md.",
  inputSchema: z.object({
    slug: slugSchema,
    instruction: z
      .string()
      .optional()
      .describe("Steer passed to every task — the chosen angle, a length target, an audience note"),
    from: z
      .enum(TASKS)
      .default("plan")
      .describe(
        "Which task to start from. After a gated pause, pass the task named in pausedBefore to continue.",
      ),
  }),
  execute: ({ slug, instruction, from }) =>
    runWorkflow(TASKS.slice(TASKS.indexOf(from)), slug, instruction),
});

