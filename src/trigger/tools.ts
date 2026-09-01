import { readArticle, saveBrief } from "./tools/brief.js";
import { runPipeline, stageTools } from "./stages/pipeline.js";

/** saveBrief starts the chain; every stage after it is text in, text out. */
export const tools = { saveBrief, runPipeline, ...stageTools, readArticle };
