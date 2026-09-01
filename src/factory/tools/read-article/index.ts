import { tool } from "ai";
import { z } from "zod";
import { readArtifact, resolveSlug, slugSchema } from "../../artifacts/store.js";

export const readArticle = tool({
  description: "Read back an artifact. Use sparingly — tasks read their own inputs from disk.",
  inputSchema: z.object({
    slug: slugSchema,
    artifact: z.enum(["request", "brief", "research", "plan", "draft"]),
  }),
  execute: async ({ slug: given, artifact }) => {
    const resolved = resolveSlug(given);
    if (typeof resolved === "string") return resolved;
    const { slug } = resolved;
    const name = artifact === "brief" ? "brief.json" : `${artifact}.md`;
    const content = await readArtifact(slug, name);
    return content === null ? `No ${name} for '${slug}' yet.` : { artifact, content };
  },
});
