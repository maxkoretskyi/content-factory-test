import { readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const TASKS_DIR = join(process.cwd(), "src", "factory", "tasks");

/** Shared by anything that has a prompt.md and calls a model. */
export const PromptConfigSchema = z.object({
  /** Provider-prefixed, resolved through the registry, e.g. "google:gemini-3.5-flash". */
  model: z.string().regex(/^google:[a-z0-9.\-]+$/, "expected 'google:<model-id>'"),
  temperature: z.number().min(0).max(2).optional(),

  /** Provider-executed tools. Google requires these exact names. */
  tools: z.array(z.enum(["google_search", "url_context"])).optional(),
  /** Task budget when the task has tools. Ignored otherwise. */
  maxTasks: z.number().int().min(1).max(50).optional(),

  /** Where a searching task should look. Rendered into its prompt. */
  sources: z.array(z.object({ search: z.string(), for: z.string() })).optional(),

  /**
   * Function tools this prompt may call, by name. Omit it to get all of them,
   * which is the normal case. Set it only to deny a prompt something — an empty
   * array means no tools at all. Only the editor uses this; tasks call no
   * functions. A name that does not exist fails at load rather than silently
   * doing nothing.
   */
  toolset: z.array(z.string()).optional(),

  /** For humans reading the directory. Never sent to a model. */
  note: z.string().optional(),
});

/**
 * The contract for a task: config.json is the whole declaration — what it reads,
 * what it writes, how it runs, and which model. Nothing about a task lives
 * anywhere else, so adding one is a directory plus a line in RUN_ORDER.
 */
export const TaskConfigSchema = PromptConfigSchema.extend({
  /** Artifacts it reads, joined in order and given to the prompt. */
  in: z.array(z.string().regex(/\.(md|json)$/, "expected a .md or .json artifact")).min(1),
  /**
   * Artifacts read if they exist and skipped if they do not. For material that
   * improves a task without being required — so a task can be added to the
   * pipeline, or taken out of it, without every downstream config changing.
   */
  optionalIn: z.array(z.string().regex(/\.(md|json)$/, "expected a .md or .json artifact")).optional(),

  /** The artifact it writes. Writing draft.md snapshots a revision. */
  out: z.string().regex(/\.(md|json)$/, "expected a .md or .json artifact"),

  /**
   * single      — one call: the whole input in, the whole output back.
   * per-section — one call per '### ' block in the plan, each seeing what came
   *               before it. Used where a single call under-writes.
   */
  mode: z.enum(["single", "per-section"]).default("single"),

  /**
   * Names an artifact schema its output must satisfy. The runner parses and
   * validates before writing, so a malformed task fails at its own boundary
   * rather than as a confusing parse error two tasks later.
   */
  validates: z.enum(["brief"]).optional(),

  /**
   * Stop before running this task and hand control back to the editor, so the
   * author can look at what the previous task produced and say whether to go on.
   *
   * The runner enforces it — a workflow returns early whether the model likes it
   * or not — because a gate that depends on the model remembering to ask is not
   * a gate. Resume with the tool's `from` argument.
   */
  gate: z.boolean().default(false),

  /**
   * The task wraps its reasoning in <analysis> and its output in <article>. The
   * analysis is filed separately, which is what makes "I changed nothing"
   * checkable rather than a claim.
   */
  emitsAnalysis: z.boolean().default(false),
});

export type PromptConfig = z.infer<typeof PromptConfigSchema>;
export type TaskConfig = z.infer<typeof TaskConfigSchema>;

/**
 * A task is a directory under tasks/ holding prompt.md and config.json. That is
 * the whole registration: no central list, no registration call. Which tasks a
 * workflow runs, and in what order, is declared by the tool that runs it.
 */
export type TaskName = string;

/** Where a task's prompt.md and config.json live, relative to tasks/. */
export const taskPath = (task: TaskName) => task;

/** Every task on disk. Read once — the set does not change while the worker runs. */
let cached: string[] | undefined;
export function taskNames(): string[] {
  cached ??= readdirSync(TASKS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== "runtime")
    .map((e) => e.name)
    .sort();
  return cached;
}
