import { tool } from "ai";
import { z } from "zod";
import { missing, readArtifact, slugSchema, writeArtifact } from "../../artifacts.js";
import { runStage } from "../_shared.js";
import { SYSTEM } from "./prompt.js";

export const formThesis = tool({
  description: "Stage 2. Turn the brief into a single arguable claim. Requires the brief.",
  inputSchema: z.object({
    slug: slugSchema,
    instruction: z.string().optional().describe("Optional steer, e.g. feedback on a previous thesis"),
  }),
  execute: async ({ slug, instruction }) => {
    const brief = await readArtifact(slug, "brief.md");
    if (!brief) return missing("brief.md", "brief");

    const text = await runStage(
      "thesis",
      SYSTEM,
      [brief, instruction && `\n## Additional steer\n\n${instruction}`].filter(Boolean).join("\n"),
    );
    await writeArtifact(slug, "thesis.md", text);
    return { saved: `articles/${slug}/thesis.md`, thesis: text };
  },
});
