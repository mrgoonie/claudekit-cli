/**
 * Check if we're running in a CI environment
 */
export function isCIEnvironment(): boolean {
	return process.env.CI === "true" || process.env.CI_SAFE_MODE === "true";
}

/**
 * Check if we're running in a non-interactive environment
 * (CI, no TTY, explicitly set NON_INTERACTIVE, etc.)
 */
export function isNonInteractive(): boolean {
	return (
		!process.stdin.isTTY || process.env.CI === "true" || process.env.NON_INTERACTIVE === "true"
	);
}
