import { readArticle, saveBrief } from "./brief.js";
import { buildOutline, formThesis, writeDraft } from "./stages/index.js";

/**
 * The orchestrator's toolset. Each stage tool is its own model call with its own
 * prompt; the prose moves between stages on disk, not through this conversation.
 *
 * Deliberately the minimum: brief -> thesis -> outline -> draft. Review stages are
 * written but not wired yet — they get added one at a time, so each addition can be
 * judged against the draft that came before it.
 */
export const tools = { saveBrief, formThesis, buildOutline, writeDraft, readArticle };
