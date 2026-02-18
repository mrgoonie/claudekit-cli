/**
 * Shared utilities - re-exports all shared modules
 */

export { logger } from "./logger.js";
export {
	getHomeDirectoryFromEnv,
	getOptimalConcurrency,
	isMacOS,
	isWindows,
	shouldSkipExpensiveOperations,
} from "./environment.js";
export {
	CLAUDEKIT_CLI_GLOBAL_INSTALL_COMMAND,
	CLAUDEKIT_CLI_INSTALL_COMMANDS,
	CLAUDEKIT_CLI_NPM_PACKAGE_NAME,
	CLAUDEKIT_CLI_NPM_PACKAGE_URL,
	getCliUserAgent,
	getCliVersion,
	DEFAULT_NETWORK_TIMEOUT_MS,
} from "./claudekit-constants.js";
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
export {
	operationError,
	notFoundError,
	validationError,
	securityError,
} from "./error-utils.js";
export { normalizeCommand } from "./command-normalizer.js";
export { parseTimeoutMs } from "./parse-timeout.js";
