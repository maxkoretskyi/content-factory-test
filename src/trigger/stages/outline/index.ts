import { tool } from "ai";
import { z } from "zod";
import { missing, readArtifact, slugSchema, writeArtifact } from "../../artifacts.js";
import { runStage } from "../_shared.js";
import { SYSTEM } from "./prompt.js";

export const buildOutline = tool({
  description:
    "Stage 3. Turn the thesis into an argument structure with checkable evidence per section. Requires the thesis.",
  inputSchema: z.object({
    slug: slugSchema,
    instruction: z.string().optional().describe("Optional steer, e.g. a length target or required section"),
  }),
  execute: async ({ slug, instruction }) => {
    const [brief, thesis] = await Promise.all([
      readArtifact(slug, "brief.md"),
      readArtifact(slug, "thesis.md"),
    ]);
    if (!thesis) return missing("thesis.md", "thesis");

    const text = await runStage(
      "outline",
      SYSTEM,
      [brief, thesis, instruction && `\n## Additional steer\n\n${instruction}`].filter(Boolean).join("\n\n"),
    );
    await writeArtifact(slug, "outline.md", text);
    return { saved: `articles/${slug}/outline.md`, outline: text };
  },
});
