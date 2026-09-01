import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "proj_nmtieqhvihszxfnxoqup",
  dirs: ["./src/trigger"],
  // CPU time, not wall clock — time spent suspended between chat turns doesn't
  // count, so an hour of actual compute is generous for a conversation.
  maxDuration: 3600,
});
