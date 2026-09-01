import { chat } from "@trigger.dev/sdk/ai";
import { streamText, stepCountIs } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { tools } from "./tools.js";

// The provider defaults to GOOGLE_GENERATIVE_AI_API_KEY; point it at our var instead.
const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });

export const myChat = chat.agent({
  id: "my-chat",
  // Declared here as well as on streamText: the SDK re-converts prior-turn
  // history each turn and needs the tool map to re-apply toModelOutput.
  tools,
  run: async ({ messages, tools, signal }) =>
    streamText({
      // Spread this FIRST — it wires up prepareStep (compaction, steering,
      // background injection), the chat.prompt() system prompt, and telemetry.
      // It also sets streamText's `tools` from the map passed here.
      ...chat.toStreamTextOptions({ tools }),
      model: google("gemini-3.5-flash"),
      // Gemini 3.x thinks by default, which cost ~1.2s of time-to-first-token
      // on a trivial prompt. Off.
      providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
      messages,
      abortSignal: signal,
      stopWhen: stepCountIs(15),
    }),
});
