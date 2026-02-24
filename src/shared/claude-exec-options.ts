/**
 * Shared exec options for Claude CLI subprocess calls.
 * Used by cc-version-checker.ts and plugin-installer.ts.
 *
 * Strips CLAUDE* env vars (except CLAUDE_CONFIG_DIR) to prevent
 * nested session detection — without this, the `claude` subprocess
 * detects the parent CC session and refuses to run, since CC disallows
 * spawning nested CC instances via env markers like CLAUDECODE.
 */

/**
 * Build env and exec options for a `claude` CLI subprocess.
 * @param timeout - max execution time in milliseconds
 */
export function buildExecOptions(timeout: number) {
	const env = { ...process.env };
	for (const key of Object.keys(env)) {
		if (key.startsWith("CLAUDE") && key !== "CLAUDE_CONFIG_DIR") {
			delete env[key];
		}
	}
	return {
		timeout,
		env,
		shell: process.platform === "win32",
	};
}
