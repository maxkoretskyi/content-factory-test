import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createProviderRegistry, generateText, stepCountIs, type ToolSet } from "ai";
import { createGoogleGenerativeAI, google } from "@ai-sdk/google";
import {
  PromptConfigSchema,
  TaskConfigSchema,
  taskPath,
  type PromptConfig,
  type TaskConfig,
  type TaskName,
} from "./schema.js";

const registry = createProviderRegistry({
  google: createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY }),
});

/**
 * A task is a directory: prompt.md is what it's told, config.json is everything
 * else — what it reads and writes, how it runs, which model. Both are data, so
 * the editorial policy is readable without opening TypeScript.
 *
 * Tasks live under tasks/<workflow>/<task>/, beside the workflow that runs them.
 * The tools are thin: a tool imports a workflow's task list and hands it to this
 * runtime. The editor never sees a task.
 *
 * These files are copied into the build by additionalFiles in trigger.config.ts —
 * without it they exist in dev and vanish on deploy. They live outside src/trigger
 * because none of this is a Trigger task; only the agent in src/trigger is.
 */
const FACTORY = join(process.cwd(), "src", "factory");
const TASKS = join(FACTORY, "tasks");
const NL = String.fromCharCode(10);

/** Google requires these exact tool names; they run on Google's side, not ours. */
function toolsFor(config: PromptConfig): ToolSet | undefined {
  if (!config.tools?.length) return undefined;
  const available = {
    google_search: google.tools.googleSearch({}),
    url_context: google.tools.urlContext({}),
  };
  return Object.fromEntries(config.tools.map((t) => [t, available[t]])) as ToolSet;
}

/**
 * Read every time, deliberately. Caching meant a running worker kept serving a
 * prompt you had already edited — and since .md files aren't imported by anything,
 * the dev watcher won't necessarily restart the worker for you.
 */
export const loadTask = (task: TaskName) =>
  loadFrom(join(TASKS, taskPath(task)), task, TaskConfigSchema) as {
    system: string;
    config: TaskConfig;
  };

/** The editor, and anything else that is prompted but is not a task. */
export const loadPrompt = (name: string) => loadFrom(join(FACTORY, name), name, PromptConfigSchema);

function loadFrom(folder: string, label: string, schema: typeof PromptConfigSchema | typeof TaskConfigSchema) {
  const raw = JSON.parse(readFileSync(join(folder, "config.json"), "utf8"));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    // Fail at load with the field named, rather than somewhere downstream with a
    // confusing model error.
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new Error(`Invalid config for '${label}':${NL}  ${issues.join(NL + "  ")}`);
  }
  const config = parsed.data;
  let system = readFileSync(join(folder, "prompt.md"), "utf8");

  // The list of places to look is config, not prose: it is the part you edit most
  // often, and it is a set of settings rather than instructions.
  if (config.sources?.length) {
    const list = config.sources.map((s) => "- " + (s.search ? "`" + s.search + "` — " : "") + s.for);
    system = [system, "", "## Where to look", "", ...list].join(NL);
  }

  return { system, config };
}

export const resolveModel = (config: PromptConfig) =>
  registry.languageModel(config.model as `google:${string}`);

/** One task: text in, text out, in its own context with its own prompt and model. */
export async function runTask(task: TaskName, input: string) {
  const { system, config } = loadTask(task);
  const tools = toolsFor(config);
  const { text } = await generateText({
    model: resolveModel(config),
    temperature: config.temperature,
    system,
    prompt: input,
    ...(tools ? { tools, stopWhen: stepCountIs(config.maxTasks ?? 12) } : {}),
  });
  return text.trim();
}
