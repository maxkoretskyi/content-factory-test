import { tool } from "ai";
import { z } from "zod";
import { slugSchema } from "../../artifacts/store.js";
import { runOne } from "../../tasks/runtime/run.js";
import { taskNames } from "../../tasks/runtime/schema.js";

/**
 * One tool for every targeted rerun, rather than one tool per task. Six
 * near-identical tools invite the editor to sequence them by hand, which is
 * exactly what the phases exist to prevent.
 */
export const rerunTask = tool({
  description:
    "Re-run a single task on an article that already exists. For author feedback — 'tighten it' is compress, 'section three is thin' is enrich. Never use this to work through the pipeline: find-angle and make-draft do that.",
  inputSchema: z.object({
    slug: slugSchema,
    task: z
      .string()
      .describe("Which task to re-run — any task a tool owns, e.g. compress or enrich"),
    instruction: z
      .string()
      .describe("What to change, in the author's words where they gave them"),
    redo: z
      .boolean()
      .default(false)
      .describe("enrich only: rewrite every section instead of reusing the ones already written"),
  }),
  execute: ({ slug, task, instruction, redo }) => {
    // Validated here rather than by an enum: the set of tasks is assembled from
    // whatever the tools registered, so it is only known at runtime.
    if (!taskNames().includes(task)) {
      return `No such task '${task}'. Available: ${taskNames().join(", ")}.`;
    }
    return runOne(task, slug, instruction, redo);
  },
});

