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
export {
	BUILD_ARTIFACT_DIRS,
	CLAUDE_CODE_INTERNAL_DIRS,
	SKIP_DIRS_ALL,
	SKIP_DIRS_CLAUDE_INTERNAL,
} from "./skip-directories.js";
