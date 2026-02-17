/**
 * ClaudeKit-wide constants that should stay consistent across modules.
 * Centralizing these avoids drift between update/version/health-check paths.
 */
export const CLAUDEKIT_CLI_NPM_PACKAGE_NAME = "claudekit-cli";
export const CLAUDEKIT_CLI_NPM_PACKAGE_URL = `https://www.npmjs.com/package/${CLAUDEKIT_CLI_NPM_PACKAGE_NAME}`;
export const CLAUDEKIT_CLI_GLOBAL_INSTALL_COMMAND = `npm install -g ${CLAUDEKIT_CLI_NPM_PACKAGE_NAME}`;
export const DEFAULT_NETWORK_TIMEOUT_MS = 3_000;
