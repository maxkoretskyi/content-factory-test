import { defineConfig } from "@trigger.dev/sdk";
import { additionalFiles } from "@trigger.dev/build/extensions/core";

export default defineConfig({
  project: "proj_nmtieqhvihszxfnxoqup",
  dirs: ["./src/trigger"],
  // CPU time, not wall clock — time spent suspended between chat turns doesn't
  // count, so an hour of actual compute is generous for a conversation.
  maxDuration: 3600,
  build: {
    // Stage prompts and configs are data files, not imports — the bundler would
    // otherwise leave them behind and every stage would fail on a deployed run.
    // They live in src/factory, which `dirs` does not scan: it holds no tasks.
    extensions: [additionalFiles({ files: ["./src/factory/**/*.md", "./src/factory/**/*.json"] })],
  },
});
