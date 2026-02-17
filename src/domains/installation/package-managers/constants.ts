import { CLAUDEKIT_CLI_NPM_PACKAGE_NAME } from "@/shared/claudekit-constants.js";

/**
 * Package name used when detecting how ClaudeKit CLI was installed.
 */
export const PM_DETECTION_TARGET_PACKAGE = CLAUDEKIT_CLI_NPM_PACKAGE_NAME;

/**
 * Timeout for short package-manager commands.
 */
export const PM_VERSION_COMMAND_TIMEOUT_MS = 3_000;

/**
 * Timeout for package-manager ownership queries.
 */
export const PM_QUERY_TIMEOUT_MS = 5_000;
