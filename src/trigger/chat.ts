import { chat } from "@trigger.dev/sdk/ai";
import { streamText, stepCountIs } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

// The provider defaults to GOOGLE_GENERATIVE_AI_API_KEY; point it at our var instead.
const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });

export const myChat = chat.agent({
  id: "my-chat",
  run: async ({ messages, signal }) =>
    streamText({
      // Spread this FIRST — it wires up prepareStep (compaction, steering,
      // background injection), the chat.prompt() system prompt, and telemetry.
      // Omitting it makes all of those silently no-op.
      ...chat.toStreamTextOptions(),
      model: google("gemini-3.5-flash"),
      // Gemini 3.x thinks by default, which cost ~3-8s of time-to-first-token
      // on a trivial prompt. Off.
      providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
      messages,
      abortSignal: signal,
      stopWhen: stepCountIs(15),
    }),
});
