import { tool } from "ai";
import { z } from "zod";
import { missing, readArtifact, slugSchema, snapshotDraft } from "../../artifacts.js";
import { runStage } from "../_shared.js";
import { SYSTEM } from "./prompt.js";

export const reviseDraft = tool({
  description:
    "Apply feedback or review notes to the current draft, changing only what was asked. Use this for user feedback instead of redrafting.",
  inputSchema: z.object({
    slug: slugSchema,
    instruction: z
      .string()
      .describe("What to change. User feedback verbatim where possible, or notes from a review stage."),
  }),
  execute: async ({ slug, instruction }) => {
    const draft = await readArtifact(slug, "draft.md");
    if (!draft) return missing("draft.md", "draft");

    const text = await runStage(
      "revise",
      SYSTEM,
      `## Instruction\n\n${instruction}\n\n## Current draft\n\n${draft}`,
    );
    return snapshotDraft(slug, text, instruction.slice(0, 120));
  },
});
