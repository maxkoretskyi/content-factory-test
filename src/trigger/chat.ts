import { chat } from "@trigger.dev/sdk/ai";
import { streamText, stepCountIs } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { tools } from "./tools.js";

const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });

const ORCHESTRATOR = `You are the editor running a writing team. You do not write the article
yourself — each stage tool is a specialist with its own prompt and its own model. Your job is
to decide which specialist runs next, with what instruction, and to talk to the author.

## New brief

Run the pipeline in order. Each stage reads its own input from disk, so pass a slug, not text.

  saveBrief -> formThesis -> buildOutline -> writeDraft

Pick a kebab-case slug from the topic and reuse it for the whole conversation.

## Feedback on an existing draft

There is no revision stage yet. Say so plainly rather than redrafting from scratch — a full
redraft loses everything the author already accepted.

## Reporting

Keep your own output short. You are not reproducing the article — the author reads it in
articles/<slug>/draft.md. Say what ran and what you would question about the result.`;

export const myChat = chat.agent({
  id: "my-chat",
  tools,
  // onBoot, not onChatStart: onChatStart fires once per chat, so a continuation
  // run on a fresh worker would skip it and leave the prompt unset.
  onBoot: async () => {
    chat.prompt.set(ORCHESTRATOR);
  },
  run: async ({ messages, tools, signal }) =>
    streamText({
      ...chat.toStreamTextOptions({ tools }),
      // The orchestrator only routes; the expensive thinking happens inside the
      // stage tools, each of which picks its own model.
      model: google("gemini-3.5-flash"),
      messages,
      abortSignal: signal,
      stopWhen: stepCountIs(40),
    }),
});
