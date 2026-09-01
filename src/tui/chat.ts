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
import type { myChat } from "../trigger/chat.js";

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

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

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

/**
 * The slug is the same on every call and the path is already in each result, so
 * showing it just eats the width that the instruction should be using.
 */
function describe(input: unknown) {
  if (!input || typeof input !== "object") return "";
  const rest = { ...(input as Record<string, unknown>) };
  delete rest.slug;
  if (rest.redo === false) delete rest.redo;

  const instruction = typeof rest.instruction === "string" ? rest.instruction : undefined;
  delete rest.instruction;

  const tail = Object.keys(rest).length ? " " + JSON.stringify(rest) : "";
  const said = instruction ? "  " + instruction.replace(/\s+/g, " ") : "";
  const line = (tail + said).trim();
  return line ? "  " + (line.length > 90 ? line.slice(0, 90) + "…" : line) : "";
}

type Ask = {
  messageId: string;
  toolCallId: string;
  question: string;
  options: { id: string; label: string; detail?: string }[];
};

/** Consume one turn. Returns a pending question if the agent suspended on one. */
async function consume(stream: AsyncIterable<any>): Promise<Ask | undefined> {
  const spin = spinner();
  spin.start("thinking");
  let streaming = false;
  let messageId = "";
  let ask: Ask | undefined;

  try {
    for await (const chunk of stream) {
      if (chunk.type === "start" && chunk.messageId) messageId = chunk.messageId;

      if (chunk.type === "tool-input-available") {
        // ask-user has no execute: this call is the end of the turn, not a task.
        if (chunk.toolName === "ask-user") {
          spin.stop();
          ask = { messageId, toolCallId: chunk.toolCallId, ...(chunk.input as any) };
          continue;
        }
        spin.start(`${chunk.toolName}${describe(chunk.input)}`);
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
  return ask;
}

/** Render the options, take a pick, and resume the suspended run with the answer. */
async function answer(ask: Ask) {
  console.log(`\n${ask.question}\n`);
  ask.options.forEach((o, i) => {
    console.log(`  ${i + 1}. ${o.label}`);
    if (o.detail) console.log(`     ${o.detail.replace(/\n/g, "\n     ")}\n`);
  });

  let chosen: (typeof ask.options)[number] | undefined;
  while (!chosen) {
    const reply = (await rl.question(`pick 1-${ask.options.length} > `)).trim();
    chosen = ask.options[Number(reply) - 1];
    if (!chosen) console.log("  not one of the options");
  }

  // The slim continuation shape: the agent overlays this tool-state advance onto
  // the assistant message it is holding, so only the resolved part is needed.
  return agent.sendRaw([
    {
      id: ask.messageId,
      role: "assistant",
      parts: [
        {
          type: "tool-ask-user",
          toolCallId: ask.toolCallId,
          state: "output-available",
          output: { id: chosen.id, label: chosen.label },
        },
      ],
    },
  ]);
}

/** Send a message, then keep answering questions until the agent stops asking. */
async function say(text: string) {
  let ask = await consume(await agent.sendMessage(text));
  while (ask) {
    if (once !== undefined) {
      console.log(`\n(agent is waiting on a choice — run without --once to answer)`);
      return;
    }
    ask = await consume(await answer(ask));
  }
}

console.log(`conversation: ${chatId}\n`);

if (once !== undefined) {
  await say(once);
  await agent.close();
  rl.close();
} else {
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
