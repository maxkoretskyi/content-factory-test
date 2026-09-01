import { tool } from "ai";
import { z } from "zod";

/**
 * Deliberately has no `execute`. When the model calls it, streamText ends with
 * the call still open, the turn completes, and the run suspends — freeing its
 * compute and stopping the clock, so the author can take an hour to choose an
 * angle without being billed for it. Their answer resumes the same run.
 */
export const askUser = tool({
  description:
    "Put a decision to the author and stop until they answer. Use this for the research angle shortlist — never pick an angle yourself. The options you pass are what they choose from, so make each one self-contained.",
  inputSchema: z.object({
    question: z.string().describe("What you are asking them to decide"),
    options: z
      .array(
        z.object({
          id: z.string().describe("short kebab-case id you will recognise in the answer"),
          label: z.string().describe("the option in one line — for an angle, the claim itself"),
          detail: z
            .string()
            .optional()
            .describe("why it qualifies, the strongest evidence, and the risk"),
        }),
      )
      .min(2)
      .max(8),
  }),
});
