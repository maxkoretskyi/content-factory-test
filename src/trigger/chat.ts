import { chat } from "@trigger.dev/sdk/ai";
import { streamText, stepCountIs } from "ai";
import { loadPrompt, resolveModel } from "../factory/tasks/runtime/load.js";
import { toolsFrom } from "../factory/editor/tool-registry.js";

// Prompt and model live in src/factory/editor/, same as every task —
// no prompt text in TypeScript, and a model swap is a one-line JSON edit.
const editor = loadPrompt("editor");
const tools = toolsFrom(editor.config.toolset);

/**
 * Tools that spend money and produce an artifact. Once one has run in a turn, the
 * editor may not call another — it has to come back to the author first.
 *
 * This is enforced here rather than asked for in the prompt, because "always
 * confirm before continuing" is exactly the kind of instruction a model follows
 * until the moment it is confident, which is the moment it matters.
 */
const PRODUCERS = new Set(["classify", "find-angle", "make-draft", "revise", "rerun-task"]);

export const myChat = chat.agent({
  id: "my-chat",
  tools,
  run: async ({ messages, tools, signal }) => {
    // Read per turn, not in onBoot: onBoot fires once per worker, so a warm worker
    // would keep serving a prompt you had already edited.
    chat.prompt.set(loadPrompt("editor").system);

    const base = chat.toStreamTextOptions({ tools });

    return streamText({
      ...base,
      // Spread first, then wrap: the SDK's own prepareStep drives compaction,
      // steering and background injection, so it has to run and its result has to
      // survive. We only add a restriction on top of whatever it returns.
      prepareStep: async (options) => {
        // toStreamTextOptions is loosely typed here; the callback shape is the
        // SDK's own, so it is safe to call with what we were handed.
        const inheritedStep = base.prepareStep as
          | ((o: typeof options) => unknown | Promise<unknown>)
          | undefined;
        const inherited = ((await inheritedStep?.(options)) ?? {}) as Record<string, unknown>;
        // Only the each-step policy is enforced here. The looser policies are
        // instructions in the prompt, because there is nothing to enforce: the
        // author has said to keep going.
        if (editor.config.confirm !== "each-step") return inherited;

        const alreadyProduced = options.steps.some((step) =>
          step.toolCalls?.some((call) => PRODUCERS.has(call.toolName)),
        );
        return alreadyProduced
          ? { ...inherited, activeTools: ["ask-user", "read-article"] }
          : inherited;
      },
      model: resolveModel(editor.config),
      messages,
      abortSignal: signal,
      stopWhen: stepCountIs(40),
    });
  },
});
