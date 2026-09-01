import { tool } from "ai";
import { z } from "zod";
import {
  countWords,
  readArtifact,
  slugSchema,
  snapshotDraft,
  writeAnalysis,
  writeArtifact,
} from "../state/artifacts.js";
import { runStage } from "./_shared.js";

/**
 * The pipeline. Every stage has the same shape: read the previous artifact, run it
 * through this stage's prompt and model, write the next artifact.
 *
 * Build by progressively adding, then progressively remove what doesn't strengthen
 * the argument, checking after each that the structure survived. The two verify
 * passes are the same stage on different inputs — the first checks the argument was
 * built well, the second checks that cutting didn't break it.
 */
export const PIPELINE = [
  { stage: "plan", in: "brief.md", out: "plan.md" },
  { stage: "enrich", in: "plan.md", out: "draft.md" },
  { stage: "compress", in: "draft.md", out: "draft.md" },
  { stage: "verify", in: "draft.md", out: "draft.md" },
] as const;

/** One stage: read the previous artifact, run it through this stage, write the next. */
async function runOne(stage: (typeof PIPELINE)[number]["stage"], slug: string, instruction?: string) {
  const { in: input, out } = PIPELINE.find((p) => p.stage === stage)!;
  {
    {
      const source = await readArtifact(slug, input);
      if (!source) return `Cannot run '${stage}': articles/${slug}/${input} does not exist yet.`;

      const raw = await runStage(
        stage,
        instruction ? `${source}\n\n# Additional instruction\n\n${instruction}` : source,
      );

      // A stage may show its work: anything inside <analysis> is filed separately
      // and the article is taken from <article>. A stage that decides to change
      // nothing then has to say why, in a form we can read back.
      const { text, analysis, malformed } = splitOutput(raw);
      const analysisFile = analysis ? await writeAnalysis(slug, stage, analysis) : undefined;

      // Every write to the draft is snapshotted, so the before/after trail
      // accumulates without anyone remembering to commit at the right moment.
      if (out === "draft.md") await snapshotDraft(slug, text, stage, instruction ?? "no instruction");
      else await writeArtifact(slug, out, text);

      return {
        stage,
        saved: `articles/${slug}/${out}`,
        wordsIn: countWords(source),
        wordsOut: countWords(text),
        // Structural artifacts come back in full so the orchestrator can judge
        // them. Prose never does — the draft would then flow through this
        // conversation on every stage, twice, and cost more each revision.
        ...(out === "draft.md" ? {} : { content: text }),
        ...(analysisFile ? { analysis: analysisFile, findings: analysis } : {}),
        ...(malformed ? { warning: "Stage did not emit the expected <analysis>/<article> tags; treating the whole output as the article." } : {}),
        unchanged: text.trim() === source.trim(),
      };
    }
  }
}

function makeStageTool({ stage, in: input, out }: (typeof PIPELINE)[number]) {
  return tool({
    description: `Run just the '${stage}' stage: ${input} -> ${out}. Use for targeted reruns; use runPipeline for a new brief.`,
    inputSchema: z.object({
      slug: slugSchema,
      instruction: z.string().optional().describe("Optional steer passed to this stage only"),
    }),
    execute: ({ slug, instruction }) => runOne(stage, slug, instruction),
  });
}

/**
 * The standard run. The orchestrator decides *whether* to run it and handles
 * everything after; it does not get to execute it step by step, because a model
 * asked to perform a fixed five-step sequence will drop the last step — which is
 * exactly what happened to the post-compression verify pass.
 */
const SEP = String.fromCharCode(10, 10);

/**
 * Verify runs last, once. Its job is to check that nothing earlier corrupted
 * the article — so it should see the article in the state the reader will.
 */
const RUN_ORDER: (typeof PIPELINE)[number]["stage"][] = [
  "plan",
  "enrich",
  "compress",
  "verify",
];

export const runPipeline = tool({
  description:
    "Run the whole pipeline in order: plan, enrich, compress, verify. Use this for a new brief. Requires the brief to be saved first.",
  inputSchema: z.object({
    slug: slugSchema,
    instruction: z
      .string()
      .optional()
      .describe("Steer passed to every stage, e.g. a word target or audience note"),
    from: z
      .enum(["plan", "enrich"])
      .default("plan")
      .describe("Where to start. Use 'enrich' when the plan has already been run and approved."),
  }),
  execute: async ({ slug, instruction, from }) => {
    const steps: unknown[] = [];
    const order = from === "enrich" ? RUN_ORDER.slice(1) : RUN_ORDER;
    for (const [i, step] of order.entries()) {
      const result = await runOne(step, slug, instruction);
      steps.push({ step: i + 1, ...(typeof result === "string" ? { error: result } : result) });
      // A stage that cannot find its input returns a string; stop rather than
      // running the rest of the pipeline against a missing artifact.
      if (typeof result === "string") return { ranTo: i, steps, stopped: result };
    }
    return { steps };
  },
});

export const stageTools = Object.fromEntries(
  PIPELINE.map((s) => [s.stage, makeStageTool(s)]),
) as Record<(typeof PIPELINE)[number]["stage"], ReturnType<typeof makeStageTool>>;

/** Stages that show their work wrap it in tags; the rest return the article plainly. */
function splitOutput(raw: string) {
  const analysis = raw.match(/<analysis>([\s\S]*?)<\/analysis>/i)?.[1]?.trim();
  const article = raw.match(/<article>([\s\S]*?)<\/article>/i)?.[1]?.trim();

  if (analysis && article) return { text: article, analysis, malformed: false };
  if (analysis && !article) {
    // Analysis but no article: the stage talked instead of producing output.
    return { text: raw.replace(/<analysis>[\s\S]*?<\/analysis>/i, "").trim(), analysis, malformed: true };
  }
  return { text: raw, analysis: undefined, malformed: false };
}
