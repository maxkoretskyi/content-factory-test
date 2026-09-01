import { tool } from "ai";
import { z } from "zod";
import { slugSchema } from "../../artifacts/store.js";
import { runWorkflow } from "../../tasks/runtime/run.js";

/** The tasks this tool runs, in order. */
const TASKS = ["research"] as const;

export const findAngle = tool({
  description:
    "Search the web for candidate angles. Requires brief.json, so run classify first — the search is seeded from the terms it produced. Ends with a shortlist the author must choose from: put that to them with ask-user.",
  inputSchema: z.object({
    slug: slugSchema,
    instruction: z.string().optional().describe("Steer passed to both tasks"),
  }),
  execute: ({ slug, instruction }) => runWorkflow(TASKS, slug, instruction),
});

