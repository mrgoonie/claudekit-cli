/**
 * UI domain - user interface utilities and prompts
 */

export { OwnershipDisplay } from "./ownership-display.js";
export type { OwnershipCheckResult, OwnershipSummary } from "./ownership-display.js";

export { OwnershipPrompts } from "./ownership-prompts.js";
export type { ModifiedFileDecision } from "./ownership-prompts.js";

export { PromptsManager } from "./prompts.js";

export { displayConflictSummary, buildConflictSummary } from "./conflict-summary.js";
export type { ConflictSummary } from "./conflict-summary.js";
