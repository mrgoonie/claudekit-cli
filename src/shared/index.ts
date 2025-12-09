/**
 * Shared utilities - re-exports all shared modules
 */

export { logger } from "./logger.js";
export { getOptimalConcurrency, isMacOS, isWindows } from "./environment.js";
export {
	supportsUnicode,
	getStatusSymbols,
	COLOR_PALETTE,
	type StatusSymbols,
	type StatusType,
} from "./terminal-utils.js";
export { PathResolver } from "./path-resolver.js";
export { createSpinner } from "./safe-spinner.js";
export { intro, outro, note, log, clack } from "./safe-prompts.js";
