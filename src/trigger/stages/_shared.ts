import { generateText, stepCountIs, type LanguageModel, type ToolSet } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });

export type StageName =
  | "thesis"
  | "outline"
  | "draft"
  | "review-structure"
  | "review-facts"
  | "review-line"
  | "revise";

/**
 * One place to tune which model does which job.
 *
 * Generative stages (thesis, outline, draft, revise) get the strongest model and
 * room to be interesting. Review stages get a *different* model on purpose: a
 * critic that shares the drafter's weights shares its blind spots and tends to
 * ratify its habits. With a single provider that only buys generation-diversity,
 * not family-diversity — a second provider's key would be a real improvement.
 *
 * Review temperatures are low: criticism should be boring and repeatable.
 */
export const MODELS: Record<StageName, { model: LanguageModel; temperature?: number }> = {
  thesis: { model: google("gemini-3.1-pro-preview"), temperature: 0.7 },
  outline: { model: google("gemini-3.1-pro-preview"), temperature: 0.6 },
  draft: { model: google("gemini-3.1-pro-preview"), temperature: 0.8 },
  "review-structure": { model: google("gemini-3.5-flash"), temperature: 0.2 },
  "review-facts": { model: google("gemini-3.5-flash"), temperature: 0.1 },
  "review-line": { model: google("gemini-3.5-flash"), temperature: 0.2 },
  revise: { model: google("gemini-3.1-pro-preview"), temperature: 0.7 },
};

/** Each stage is its own model call with its own prompt and a fresh context. */
export async function runStage(stage: StageName, system: string, prompt: string) {
  const { text } = await generateText({ ...MODELS[stage], system, prompt });
  return text.trim();
}

/** Same, but the stage may use tools (retrieval) inside its own loop. */
export async function runStageWithTools(
  stage: StageName,
  system: string,
  prompt: string,
  tools: ToolSet,
  maxSteps = 12,
) {
  const { text } = await generateText({
    ...MODELS[stage],
    system,
    prompt,
    tools,
    stopWhen: stepCountIs(maxSteps),
  });
  return text.trim();
}
