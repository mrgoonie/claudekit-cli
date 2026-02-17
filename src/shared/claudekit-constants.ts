/**
 * ClaudeKit-wide constants that should stay consistent across modules.
 * Centralizing these avoids drift between update/version/health-check paths.
 */
export const CLAUDEKIT_CLI_NPM_PACKAGE_NAME = "claudekit-cli";
export const CLAUDEKIT_CLI_NPM_PACKAGE_URL = `https://www.npmjs.com/package/${CLAUDEKIT_CLI_NPM_PACKAGE_NAME}`;
export const CLAUDEKIT_CLI_GLOBAL_INSTALL_COMMAND = `npm install -g ${CLAUDEKIT_CLI_NPM_PACKAGE_NAME}`;
export const CLAUDEKIT_CLI_INSTALL_COMMANDS = [
	CLAUDEKIT_CLI_GLOBAL_INSTALL_COMMAND,
	`pnpm add -g ${CLAUDEKIT_CLI_NPM_PACKAGE_NAME}`,
	`yarn global add ${CLAUDEKIT_CLI_NPM_PACKAGE_NAME}`,
	`bun add -g ${CLAUDEKIT_CLI_NPM_PACKAGE_NAME}`,
] as const;
export const CLAUDEKIT_CLI_VERSION =
	process.env.CLAUDEKIT_CLI_VERSION?.trim() || process.env.npm_package_version?.trim() || "unknown";
export const CLAUDEKIT_CLI_USER_AGENT = `${CLAUDEKIT_CLI_NPM_PACKAGE_NAME}/${CLAUDEKIT_CLI_VERSION}`;
export const DEFAULT_NETWORK_TIMEOUT_MS = 3_000;
