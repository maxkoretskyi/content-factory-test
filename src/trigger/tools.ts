import { readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { tool } from "ai";
import { z } from "zod";

const ROOT = process.cwd();

export const tools = {
  listDir: tool({
    description:
      "List the files and directories at a path inside the project. Use '.' for the project root.",
    inputSchema: z.object({
      path: z.string().describe("Path relative to the project root, e.g. '.' or 'src/trigger'"),
    }),
    execute: async ({ path }) => {
      // The tool runs in the agent's own process, so keep it inside the project.
      const target = resolve(ROOT, path);
      const rel = relative(ROOT, target);
      if (rel.startsWith("..")) {
        return { error: `Refusing to read outside the project root: ${path}` };
      }

      const entries = await readdir(target, { withFileTypes: true });
      return {
        path: rel || ".",
        entries: entries.map((e) => ({
          name: e.name,
          type: e.isDirectory() ? "dir" : "file",
        })),
      };
    },
  }),
};
