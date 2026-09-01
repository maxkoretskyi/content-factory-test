import { tool } from "ai";
import { z } from "zod";
import { missing, readArtifact, slugSchema, snapshotDraft } from "../../artifacts.js";
import { groundingTools } from "../../docs.js";
import { runStageWithTools } from "../_shared.js";
import { SYSTEM } from "./prompt.js";

export const writeDraft = tool({
  description:
    "Stage 4. Write the article from the outline, verifying every API against the docs as it goes. Requires the outline.",
  inputSchema: z.object({
    slug: slugSchema,
    instruction: z.string().optional().describe("Optional steer, e.g. a word count or audience note"),
  }),
  execute: async ({ slug, instruction }) => {
    const [brief, thesis, outline] = await Promise.all([
      readArtifact(slug, "brief.md"),
      readArtifact(slug, "thesis.md"),
      readArtifact(slug, "outline.md"),
    ]);
    if (!outline) return missing("outline.md", "outline");

    const text = await runStageWithTools(
      "draft",
      SYSTEM,
      [brief, thesis, outline, instruction && `\n## Additional steer\n\n${instruction}`]
        .filter(Boolean)
        .join("\n\n"),
      groundingTools,
    );
    // Return the path and size, not the prose: the draft must not flow back
    // through the orchestrator's context on every stage.
    return snapshotDraft(slug, text, instruction ? `draft: ${instruction}` : "first draft");
  },
});
