/**
 * Headless driver for the `my-chat` agent — no browser, no server actions.
 * Requires `npm run dev:trigger` running in another terminal.
 *
 *   npm run chat                        # interactive REPL, new conversation
 *   npm run chat -- --id my-convo       # resume an existing conversation
 *   npm run chat -- --once "hello"      # send one message, print, exit
 */
import { readFileSync } from "node:fs";
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
const fromFile = flag("file");
const agent = new AgentChat<typeof myChat>({ agent: "my-chat", id: chatId });

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

/**
 * readline delivers one line per Enter, so a pasted block arrives as several
 * lines and everything after the first would be answered by the next prompt.
 * A paste arrives as a burst, so collect anything that lands right behind the
 * first line and treat it as part of the same input.
 */
async function ask(prompt: string): Promise<string> {
  const first = await rl.question(prompt);
  const rest: string[] = [];

  // Keep collecting until input actually stops. A fixed window is not enough: a
  // long paste with a code block arrives in bursts with gaps between them, and
  // anything not collected here would be answered by the next prompt instead.
  await new Promise<void>((resolve) => {
    let timer: NodeJS.Timeout;
    const done = () => {
      rl.off("line", onLine);
      resolve();
    };
    const onLine = (line: string) => {
      rest.push(line);
      clearTimeout(timer);
      timer = setTimeout(done, 250);
    };
    rl.on("line", onLine);
    timer = setTimeout(done, 250);
  });

  return [first, ...rest].join(String.fromCharCode(10)).trim();
}

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
async function answer(question: Ask) {
  console.log(String.fromCharCode(10) + question.question + String.fromCharCode(10));
  question.options.forEach((o, i) => {
    console.log(`  ${i + 1}. ${o.label}`);
    if (o.detail) console.log(`     ${o.detail.replace(/\n/g, "\n     ")}\n`);
  });

  // Anything that isn't one of the numbers is sent as the answer verbatim. The
  // options are the agent's suggestions, not the only things you may say.
  const reply = await ask(`pick 1-${question.options.length}, or just say what you want > `);
  const picked = question.options[Number(reply) - 1];
  const chosen = picked ?? { id: "other", label: reply };

  // The slim continuation shape: the agent overlays this tool-state advance onto
  // the assistant message it is holding, so only the resolved part is needed.
  return agent.sendRaw([
    {
      id: question.messageId,
      role: "assistant",
      parts: [
        {
          type: "tool-ask-user",
          toolCallId: question.toolCallId,
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
  console.log("(/paste for multi-line, /exit to close, Ctrl-C to leave it running)");

  // --file sends the first message from disk, so a long prompt with code blocks
  // never touches the terminal's paste handling.
  if (fromFile) {
    const text = readFileSync(fromFile, "utf8").trim();
    const lineCount = text.split(String.fromCharCode(10)).length;
    console.log(`you > (${fromFile}: ${lineCount} lines, ${text.length} chars)`);
    await say(text);
  }
  try {
    while (true) {
      let line = await ask("you > ");
      if (!line) continue;
      if (line === "/exit") break;

      // Deterministic multi-line entry, for when paste detection is not reliable:
      // terminals deliver a long block in bursts, and a code fence makes the gaps
      // longer. Type /paste, paste anything, then /end on its own line.
      if (line === "/paste") {
        console.log("  (paste, then /end on its own line)");
        const block: string[] = [];
        while (true) {
          const next = await ask("");
          if (next === "/end") break;
          block.push(next);
        }
        line = block.join(String.fromCharCode(10)).trim();
        if (!line) continue;
        console.log(`  ${line.split(String.fromCharCode(10)).length} lines, ${line.length} chars`);
      }
      await say(line);
      process.stdout.write("\n");
    }
    await agent.close();
  } finally {
    rl.close();
  }
}
