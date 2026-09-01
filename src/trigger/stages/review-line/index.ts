import { tool } from "ai";
import { z } from "zod";
import { countWords, missing, readArtifact, slugSchema, snapshotDraft } from "../../artifacts.js";
import { runStage } from "../_shared.js";
import { SYSTEM } from "./prompt.js";

export const reviewLine = tool({
  description:
    "Line-edit the draft: cut and tighten only, no restructuring and no new claims. Writes a new revision of the draft.",
  inputSchema: z.object({ slug: slugSchema }),
  execute: async ({ slug }) => {
    const draft = await readArtifact(slug, "draft.md");
    if (!draft) return missing("draft.md", "draft");

    const before = countWords(draft);
    const text = await runStage("review-line", SYSTEM, draft);
    const saved = await snapshotDraft(slug, text, "line edit");
    return { ...saved, before, after: saved.words, cut: `${Math.round((1 - saved.words / before) * 100)}%` };
  },
});
