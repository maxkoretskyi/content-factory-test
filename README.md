# content-factory

A writing agent built on Trigger.dev's `chat.agent`. You give it a topic; it works out who the
article is for, searches for an angle worth arguing, drafts it, and revises against your
feedback — as one durable conversation you can leave and come back to.

## How it is put together

```
src/
  tui/chat.ts        a terminal client
  trigger/chat.ts    the agent — the only Trigger task in the project
  factory/
    editor/          the prompt that drives the conversation, its model, its tool registry
    tools/           what the editor can do — eight thin definitions
    tasks/           runtime/ plus one directory per task
    artifacts/       what an article is on disk
```

Three layers, one direction of dependency: **tools → tasks → artifacts**.

**The editor** is the conversation. It routes, judges, and talks to you — and never writes
prose. It runs on a cheap model because deciding what to call next does not need more.

**Tools** are what it can do. Two of them run workflows:

| Tool | Runs |
|---|---|
| `save-request` | records your words verbatim |
| `classify` | `classify` |
| `find-angle` | `research` |
| `ask-user` | nothing — no `execute`, so the run suspends until you answer |
| `make-draft` | `evidence` → `plan` → `enrich` → `compress` → `verify` |
| `revise` | `revise` → `verify` |
| `rerun-task` | one named task |
| `read-article` | reads an artifact back |

**Tasks** are the work. Each is a directory holding `prompt.md` and `config.json`, and the
config is the whole declaration — what it reads, what it writes, which model, at what
temperature. No prompt text lives in TypeScript, and prompts are re-read on every call, so
editing one takes effect on your next message.

```json
// tasks/verify/config.json
{
  "in": ["draft.md"], "out": "draft.md",
  "emitsAnalysis": true,
  "model": "google:gemini-3.5-flash", "temperature": 0.2,
  "note": "Deliberately a different model from the one that wrote the prose."
}
```

**Artifacts** are the state between tasks. Nothing is passed in memory: `plan` writes `plan.md`,
`enrich` declares it as an input, and the prose never travels through the conversation. That is
why a twelfth revision costs the same as the first.

```
articles/<slug>/
  request.md  brief.json  research.md  evidence.md  plan.md  draft.md
  sections/    one file per section, so a failed draft resumes where it died
  revisions/   01-enrich.md, 02-compress.md, … every write, diffable
  analysis/    verify's chain map and what it found
```

## Two things are enforced in code, not asked for in the prompt

**Order.** `make-draft` is one tool call that runs five tasks in a loop. Earlier it was the
model's job to run them in sequence, and it dropped the last one.

**Confirmation.** Once a tool that produces an artifact has run, `prepareStep` restricts the
turn to `ask-user` and `read-article`, so the editor cannot chain two without coming back to
you. Set `confirm` in `editor/config.json` to `each-step`, `angle-only`, or `never`.

## Running it

```bash
npm run dev:trigger                              # the worker
npm run chat                                     # a conversation
npm run chat -- --file prompts/my-brief.md       # long brief, code blocks intact
npm run chat -- --id <chatId>                    # resume one
```

Needs `TRIGGER_SECRET_KEY` and `GEMINI_API_KEY` in `.env` — see `.env.example`.

## Changing how it writes

Almost everything is data:

| To change | Edit |
|---|---|
| how a task writes | `tasks/<name>/prompt.md` |
| which model does a job | `tasks/<name>/config.json` |
| what a workflow runs | the `TASKS` array in `tools/<name>/index.ts` |
| where research looks | `sources` in `tasks/research/config.json` |
| how often it stops to ask | `confirm` in `editor/config.json` |

Adding a task is a directory with two files, plus its name in a workflow's list.
