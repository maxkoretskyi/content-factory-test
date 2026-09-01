import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createProviderRegistry, generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

const registry = createProviderRegistry({
  google: createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY }),
});

/**
 * A stage is a directory: prompt.md is what it's told, config.json is how it runs.
 * Both are data, so the whole editorial policy is readable without opening any
 * TypeScript and a model swap is a one-line JSON edit.
 *
 * These files are copied into the build by additionalFiles in trigger.config.ts —
 * without it they exist in dev and vanish on deploy.
 */
const STAGES = join(process.cwd(), "src", "trigger", "stages");

export type StageConfig = {
  model: string;
  temperature?: number;
  note?: string;
};

/**
 * Read every time, deliberately. Caching meant a running worker kept serving a
 * prompt you had already edited — and since .md files aren't imported by anything,
 * the dev watcher won't necessarily restart the worker for you. Two file reads are
 * nothing next to the model call that follows.
 */
export function loadStage(stage: string) {
  return {
    system: readFileSync(join(STAGES, stage, "prompt.md"), "utf8"),
    config: JSON.parse(readFileSync(join(STAGES, stage, "config.json"), "utf8")) as StageConfig,
  };
}

/** One stage: text in, text out, in its own context with its own prompt and model. */
export async function runStage(stage: string, input: string) {
  const { system, config } = loadStage(stage);
  const { text } = await generateText({
    model: registry.languageModel(config.model as `google:${string}`),
    temperature: config.temperature,
    system,
    prompt: input,
  });
  return text.trim();
}
