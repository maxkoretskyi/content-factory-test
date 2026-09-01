import {
  readArtifact,
  readSection,
  sectionKey,
  snapshotDraft,
  writeAnalysis,
  writeArtifact,
  writeSection,
  existingSlugs,
  resolveSlug,
} from "../../artifacts/store.js";
import { countWords, renderJson } from "../../artifacts/text.js";
import { BriefSchema } from "../../artifacts/brief.js";
import { loadTask, runTask } from "./load.js";
import { type TaskName } from "./schema.js";

type Task = TaskName;

const NL = String.fromCharCode(10);
const FENCE = String.fromCharCode(96, 96, 96);

/** Artifact schemas a task can declare via `validates`. */
const ARTIFACT_SCHEMAS = { brief: BriefSchema };

/**
 * Enrich is a loop, not a single call. Asked for a whole article in one pass the
 * model under-writes — it produces the shape of every section and the substance of
 * none. One call per planned section, each seeing the plan and everything written
 * so far, gets full-length sections and keeps the voice continuous.
 */
async function runEnrich(slug: string, instruction?: string, redo = false) {
  const plan = await readArtifact(slug, "plan.md");
  if (!plan) {
    const known = existingSlugs();
    const hint = known.length ? ` Articles that exist: ${known.join(", ")}.` : "";
    return `Cannot run 'enrich': articles/${slug}/plan.md does not exist.${hint}`;
  }

  const [head, ...blocks] = plan.split(/^### /m);
  const sections = blocks.map((b) => "### " + b.trimEnd());
  if (!sections.length) {
    return `Cannot run 'enrich': plan.md has no '### ' section blocks to write from.`;
  }

  const headings = sections.map((s) => s.split("\n")[0]).join("\n");
  const written: string[] = [];
  let reused = 0;

  for (const [i, section] of sections.entries()) {
    const key = sectionKey(section.split("\n")[0]!);

    // Resume: a section already on disk for this heading is not rewritten. A
    // failed run costs only the sections it did not reach.
    if (!redo) {
      const existing = await readSection(slug, i, key);
      if (existing) {
        written.push(existing.trim());
        reused++;
        continue;
      }
    }

    const text = await runTask(
      "enrich",
      [
        head!.trim(),
        `# All sections, for context — write only yours\n\n${headings}`,
        i === 0
          ? "# This is the opening section. Begin with the article's H1 title, then your section."
          : `# The article so far — match this voice, and do not repeat it\n\n${written.join("\n\n")}`,
        `# Write this section (${i + 1} of ${sections.length})\n\n${section}`,
        instruction ? `# Additional instruction\n\n${instruction}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    );

    await writeSection(slug, i, key, text.trim());
    written.push(text.trim());
  }

  const draft = written.join("\n\n");
  const saved = await snapshotDraft(slug, draft, "enrich", instruction ?? "no instruction");
  return {
    task: "enrich",
    ...saved,
    sections: sections.length,
    reusedFromDisk: reused,
    wordsOut: countWords(draft),
  };
}

/** One task: read its inputs, run them through the task, write its output. */
export async function runOne(task: Task, given: string, instruction?: string, redo = false) {
  // Resolve first: the model drifts on the slug between calls, and a task that
  // writes to a directory nobody else used leaves the article in pieces.
  const resolved = resolveSlug(given);
  if (typeof resolved === "string") return resolved;
  const slug = resolved.slug;
  // Declared by the task, not hardcoded here.
  if (loadTask(task).config.mode === "per-section") return runEnrich(slug, instruction, redo);

  const { config } = loadTask(task);
  const { in: inputs, out } = config;
  const parts: string[] = [];
  for (const name of inputs) {
    const body = await readArtifact(slug, name);
    if (!body) {
      // The slug is a free string the model has to repeat across tool calls, and
      // a typo lands here. Listing what exists makes the mistake obvious and the
      // recovery a single retry.
      const known = existingSlugs();
      const hint = known.length ? ` Articles that exist: ${known.join(", ")}.` : "";
      return `Cannot run '${task}': articles/${slug}/${name} does not exist.${hint}`;
    }
    parts.push(name.endsWith(".json") ? renderJson(body) : body);
  }
  const source = parts.join("\n\n");

  const raw = await runTask(
    task,
    instruction ? `${source}\n\n# Additional instruction\n\n${instruction}` : source,
  );

  // A task may show its work: anything inside <analysis> is filed separately and
  // the article is taken from <article>. A task that decides to change nothing
  // then has to say why, in a form we can read back.
  const { text, analysis, malformed } = splitOutput(raw);
  const analysisFile = analysis ? await writeAnalysis(slug, task, analysis) : undefined;

  // A task that declares `validates` must produce parseable, schema-valid JSON.
  // Failing here names the task; failing later names whatever tried to read it.
  let body = text;
  if (config.validates) {
    let stripped = text.trim();
    if (stripped.startsWith(FENCE)) {
      stripped = stripped.slice(stripped.indexOf(NL) + 1);
      if (stripped.endsWith(FENCE)) stripped = stripped.slice(0, -FENCE.length);
      stripped = stripped.trim();
    }
    try {
      body = JSON.stringify(ARTIFACT_SCHEMAS[config.validates].parse(JSON.parse(stripped)), null, 2);
    } catch (err) {
      return (
        "Task '" + task + "' did not produce valid " + config.validates + " JSON: " +
        (err instanceof Error ? err.message : String(err))
      );
    }
  }

  if (out === "draft.md") await snapshotDraft(slug, body, task, instruction ?? "no instruction");
  else await writeArtifact(slug, out, body);

  return {
    task,
    saved: `articles/${slug}/${out}`,
    wordsIn: countWords(source),
    wordsOut: countWords(text),
    // Structural artifacts come back in full so the editor can judge them.
    // Prose never does — the draft would then flow through the conversation on
    // every task, twice, and cost more on every revision.
    ...(out === "draft.md" ? {} : { content: body }),
    ...(analysisFile ? { analysis: analysisFile, findings: analysis } : {}),
    ...(malformed
      ? { warning: "Task emitted <analysis> but no <article>; treating the rest as the article." }
      : {}),
    unchanged: body.trim() === source.trim(),
  };
}

/**
 * A workflow is an ordered list of tasks. The edges between them are not declared
 * here — each task's config names the artifacts it reads and writes, so the
 * dependency graph lives in the configs and this only executes the order it is
 * given. Nothing branches or runs in parallel yet; when something does, this is
 * the function that grows an executor.
 */
export async function runWorkflow(order: readonly Task[], slug: string, instruction?: string) {
  const tasks: unknown[] = [];
  for (const [i, task] of order.entries()) {
    // A gated task stops the workflow before it runs. The editor asks the author
    // whether to continue, and resumes with `from` set to this task.
    if (i > 0 && loadTask(task).config.gate) {
      return {
        tasks,
        pausedBefore: task,
        ran: order.slice(0, i),
        remaining: order.slice(i),
        ask: `Done: ${order.slice(0, i).join(", ")}. Continue with ${task}?`,
      };
    }

    const result = await runOne(task, slug, instruction);
    tasks.push({ task: i + 1, ...(typeof result === "string" ? { error: result } : result) });
    // A task that cannot find its input returns a string; stop rather than
    // running the rest against a missing artifact.
    if (typeof result === "string") return { ranTo: i, tasks, stopped: result };
  }
  return { tasks, complete: true };
}


/** Tasks that show their work wrap it in tags; the rest return the article plainly. */
function splitOutput(raw: string) {
  const analysis = raw.match(/<analysis>([\s\S]*?)<\/analysis>/i)?.[1]?.trim();
  const article = raw.match(/<article>([\s\S]*?)<\/article>/i)?.[1]?.trim();

  if (analysis && article) return { text: article, analysis, malformed: false };
  if (analysis && !article) {
    return {
      text: raw.replace(/<analysis>[\s\S]*?<\/analysis>/i, "").trim(),
      analysis,
      malformed: true,
    };
  }
  return { text: raw, analysis: undefined, malformed: false };
}
