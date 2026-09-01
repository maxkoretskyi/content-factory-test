# content-factory

A durable AI chat agent running on Trigger.dev.

## Layering

```
your code  →  AI SDK  →  Trigger.dev
```

- **Your code** — `src/trigger/chat.ts` (the agent) and `src/trigger/tools.ts` (what it can do).
- **AI SDK** (`ai`, `@ai-sdk/google`) — talks to Gemini and runs the tool loop: model → tool → model,
  until `stopWhen`. This all happens inside a single turn.
- **Trigger.dev** (`chat.agent`) — owns everything around that turn: the conversation, the durable
  session holding history, and waking/sleeping the machine between messages.

Swapping model providers only touches the middle layer; durability is unaffected.

## Running it

```bash
npm run dev:trigger              # terminal 1 — worker
npm run chat                     # terminal 2 — REPL
npm run chat -- --id <chatId>    # resume a conversation
npm run chat -- --once "hello"   # single message
```

Needs `TRIGGER_SECRET_KEY` and `GEMINI_API_KEY` in `.env` (see `.env.example`).
