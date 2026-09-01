/**
 * Headless driver for the `my-chat` agent — no browser, no server actions.
 * Requires `npm run dev:trigger` running in another terminal.
 *
 *   npm run chat                        # interactive REPL, new conversation
 *   npm run chat -- --id my-convo       # resume an existing conversation
 *   npm run chat -- --once "hello"      # send one message, print, exit
 */
import readline from "node:readline/promises";
import { configure } from "@trigger.dev/sdk";
import { AgentChat } from "@trigger.dev/sdk/chat";
import type { myChat } from "../src/trigger/chat.js";

process.loadEnvFile(".env");
configure({ secretKey: process.env.TRIGGER_SECRET_KEY });

const argv = process.argv.slice(2);
const flag = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};

const chatId = flag("id") ?? `cli-${Date.now()}`;
const once = flag("once");
const agent = new AgentChat<typeof myChat>({ agent: "my-chat", id: chatId });

async function say(text: string) {
  const stream = await agent.sendMessage(text);
  for await (const chunk of stream) {
    if (chunk.type === "text-delta") process.stdout.write(chunk.delta);
    // Surface tool activity so it's visible in the terminal, not just the trace.
    if (chunk.type === "tool-input-available") {
      process.stdout.write(`
  [tool] ${chunk.toolName}(${JSON.stringify(chunk.input)})
`);
    }
    if (chunk.type === "tool-output-available") {
      process.stdout.write(`  [tool] -> ${JSON.stringify(chunk.output).slice(0, 300)}
`);
    }
  }
  process.stdout.write("\n");
}

console.log(`conversation: ${chatId}\n`);

if (once !== undefined) {
  await say(once);
  await agent.close();
} else {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log("(/exit to close, Ctrl-C to leave the conversation running)\n");
  try {
    while (true) {
      const line = (await rl.question("you > ")).trim();
      if (!line) continue;
      if (line === "/exit") break;
      process.stdout.write("bot > ");
      await say(line);
      process.stdout.write("\n");
    }
    await agent.close();
  } finally {
    rl.close();
  }
}
