import { tool } from "ai";
import { z } from "zod";
import { missing, readArtifact, slugSchema, writeArtifact } from "../../artifacts.js";
import { runStage } from "../_shared.js";
import { SYSTEM } from "./prompt.js";

export const reviewStructure = tool({
  description:
    "Review the draft's argument and structure. Sees only the draft, so its criticism is independent of how the draft was written.",
  inputSchema: z.object({ slug: slugSchema }),
  execute: async ({ slug }) => {
    const draft = await readArtifact(slug, "draft.md");
    if (!draft) return missing("draft.md", "draft");
    const text = await runStage("review-structure", SYSTEM, draft);
    await writeArtifact(slug, "review-structure.md", text);
    return { saved: `articles/${slug}/review-structure.md`, review: text };
  },
});
