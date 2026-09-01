import { tool } from "ai";
import { z } from "zod";
import { readArtifact, slugSchema } from "../../artifacts/store.js";

export const readArticle = tool({
  description: "Read back an artifact. Use sparingly — tasks read their own inputs from disk.",
  inputSchema: z.object({
    slug: slugSchema,
    artifact: z.enum(["request", "brief", "research", "plan", "draft"]),
  }),
  execute: async ({ slug, artifact }) => {
    const name = artifact === "brief" ? "brief.json" : `${artifact}.md`;
    const content = await readArtifact(slug, name);
    return content === null ? `No ${name} for '${slug}' yet.` : { artifact, content };
  },
});
