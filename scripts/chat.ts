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

/**
 * A pipeline turn is minutes of silence punctuated by tool calls, so the terminal
 * has to say what it is waiting on. Falls back to plain lines when stdout isn't a
 * TTY, since the animation would just be escape codes in a log.
 */
function spinner() {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const tty = process.stdout.isTTY;
  let timer: NodeJS.Timeout | undefined;
  let label = "";
  let started = 0;
  let i = 0;

  const clear = () => tty && process.stdout.write("\r\x1b[K");
  const render = () => {
    const secs = ((Date.now() - started) / 1000).toFixed(0);
    process.stdout.write(`\r\x1b[K  ${frames[i++ % frames.length]} ${label}  ${secs}s`);
  };

  return {
    start(next: string) {
      label = next;
      started = Date.now();
      if (!tty) return void console.log(`  … ${label}`);
      clear();
      render();
      timer ??= setInterval(render, 100);
    },
    done(note?: string) {
      const secs = ((Date.now() - started) / 1000).toFixed(1);
      clear();
      if (note) console.log(`  ✓ ${note}  ${secs}s`);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = undefined;
      clear();
    },
  };
}

async function say(text: string) {
  const spin = spinner();
  spin.start("thinking");
  let streaming = false;

  try {
    const stream = await agent.sendMessage(text);
    for await (const chunk of stream) {
      if (chunk.type === "tool-input-available") {
        const args = JSON.stringify(chunk.input);
        spin.start(`${chunk.toolName} ${args.length > 70 ? args.slice(0, 70) + "…" : args}`);
      }
      if (chunk.type === "tool-output-available") {
        const out = JSON.stringify(chunk.output);
        spin.done(out.length > 120 ? out.slice(0, 120) + "…" : out);
        spin.start("thinking");
      }
      if (chunk.type === "text-delta") {
        if (!streaming) {
          spin.stop();
          process.stdout.write("bot > ");
          streaming = true;
        }
        process.stdout.write(chunk.delta);
      }
    }
  } finally {
    spin.stop();
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
      await say(line);
      process.stdout.write("\n");
    }
    await agent.close();
  } finally {
    rl.close();
  }
}
