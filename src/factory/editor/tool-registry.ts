import { askUser } from "../tools/ask-user/index.js";
import { classify } from "../tools/classify/index.js";
import { findAngle } from "../tools/find-angle/index.js";
import { makeDraft } from "../tools/make-draft/index.js";
import { readArticle } from "../tools/read-article/index.js";
import { revise } from "../tools/revise/index.js";
import { rerunTask } from "../tools/rerun-task/index.js";
import { saveRequest } from "../tools/save-request/index.js";

/**
 * Everything the factory exposes. A prompt does not own these — it selects from
 * them by name in its config, so a second prompt could take a different subset
 * without any of this moving.
 *
 * What the editor can do today: It has no other way to act: it cannot read or
 * write a file, and it cannot call a model except through a task.
 *
 *   save-request   record the author's words                     (no model call)
 *   classify       work out who the article is for               (one task)
 *   find-angle     search the web for candidate angles           (one task)
 *   ask-user     put a decision to the author and suspend      (no execute)
 *   make-draft     plan + enrich + compress + verify, in code    (four tasks)
 *   rerun-task    re-run one named task, for author feedback
 *   read-article   read an artifact back
 */
const REGISTRY = {
  "save-request": saveRequest,
  "classify": classify,
  "find-angle": findAngle,
  "ask-user": askUser,
  "make-draft": makeDraft,
  "revise": revise,
  "rerun-task": rerunTask,
  "read-article": readArticle,
};

/**
 * Resolve the names a prompt's config declares. Omitting `toolset` means all of
 * them — the common case, and it means adding a tool here does not also require
 * editing a config that would silently leave it out. Narrow it only when a prompt
 * should genuinely be denied something.
 *
 * An unknown name is a config error, raised at load with the name.
 */
export function toolsFrom(names: string[] | undefined) {
  if (!names) return REGISTRY;
  if (!names.length) return {};
  const unknown = names.filter((n) => !(n in REGISTRY));
  if (unknown.length) {
    throw new Error(
      "Unknown tool(s) in toolset: " + unknown.join(", ") + ". Known: " + Object.keys(REGISTRY).join(", "),
    );
  }
  return Object.fromEntries(names.map((n) => [n, REGISTRY[n as keyof typeof REGISTRY]]));
}
