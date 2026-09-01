import { tool } from "ai";
import { z } from "zod";
import { readArtifact, slugSchema, writeArtifact } from "./artifacts.js";

/** Stage 1 is not a model call — the brief comes from the user. */
export const saveBrief = tool({
  description:
    "Stage 1. Record the brief and your reading of what the reader needs. Every other stage is gated on this.",
  inputSchema: z.object({
    slug: slugSchema,
    brief: z.string().describe("The brief as given, in the user's own words"),
    intent: z
      .string()
      .describe("Who the reader is, what they already know, and what they should be able to do after"),
  }),
  execute: ({ slug, brief, intent }) =>
    writeArtifact(slug, "brief.md", `# Brief\n\n${brief}\n\n## Intent\n\n${intent}\n`),
});

export const readArticle = tool({
  description: "Read back an artifact. Use sparingly — stages read their own inputs from disk.",
  inputSchema: z.object({
    slug: slugSchema,
    artifact: z.enum(["brief", "thesis", "outline", "draft", "review-structure", "review-facts"]),
  }),
  execute: async ({ slug, artifact }) => {
    const content = await readArtifact(slug, `${artifact}.md`);
    return content === null ? `No ${artifact}.md for '${slug}' yet.` : { artifact, content };
  },
});
