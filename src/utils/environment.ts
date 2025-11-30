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

/**
 * Check if running on macOS
 */
export function isMacOS(): boolean {
	return process.platform === "darwin";
}

/**
 * Check if running on Windows
 */
export function isWindows(): boolean {
	return process.platform === "win32";
}

/**
 * Check if running on Linux
 */
export function isLinux(): boolean {
	return process.platform === "linux";
}

/**
 * Get optimal concurrency for file operations based on platform
 * macOS has lower default file descriptor limits (256) vs Linux (1024+)
 * Windows also has different I/O characteristics
 */
export function getOptimalConcurrency(): number {
	if (isMacOS()) {
		// macOS: Lower concurrency due to ulimit defaults and Spotlight indexing
		return 10;
	}
	if (isWindows()) {
		// Windows: Moderate concurrency
		return 15;
	}
	// Linux: Higher concurrency
	return 20;
}
