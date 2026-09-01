import { tool } from "ai";
import { z } from "zod";
import { missing, readArtifact, slugSchema, writeArtifact } from "../../artifacts.js";
import { groundingTools } from "../../docs.js";
import { runStageWithTools } from "../_shared.js";
import { SYSTEM } from "./prompt.js";

export const reviewFacts = tool({
  description:
    "Fact-check the draft against the official docs. The only stage with retrieval — it verifies claims instead of recalling them.",
  inputSchema: z.object({ slug: slugSchema }),
  execute: async ({ slug }) => {
    const draft = await readArtifact(slug, "draft.md");
    if (!draft) return missing("draft.md", "draft");
    const text = await runStageWithTools("review-facts", SYSTEM, draft, groundingTools, 20);
    await writeArtifact(slug, "review-facts.md", text);
    return { saved: `articles/${slug}/review-facts.md`, review: text };
  },
});
