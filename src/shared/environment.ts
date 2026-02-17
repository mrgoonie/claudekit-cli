/**
 * Platform-specific concurrency limits for file operations
 * macOS: Lower due to ulimit defaults (256) and Spotlight indexing interference
 * Windows: Moderate I/O characteristics
 * Linux: Higher I/O limits (1024+)
 */
export const PLATFORM_CONCURRENCY = {
	MACOS: 10,
	WINDOWS: 15,
	LINUX: 20,
} as const;

/**
 * Check if we're running in a CI environment
 */
export function isCIEnvironment(): boolean {
	return process.env.CI === "true" || process.env.CI_SAFE_MODE === "true";
}

/**
 * Check if we're running in an isolated test environment
 * where expensive operations should still run.
 */
function isIsolatedTestEnvironment(): boolean {
	return Boolean(process.env.CK_TEST_HOME);
}

/**
 * Check if expensive operations should be skipped.
 * Skip in CI unless tests are running with isolated paths.
 */
export function shouldSkipExpensiveOperations(): boolean {
	if (isIsolatedTestEnvironment()) {
		return false;
	}
	return isCIEnvironment();
}

/**
 * Resolve home directory from environment variables.
 * Uses platform-specific preference with a safe cross-platform fallback.
 */
export function getHomeDirectoryFromEnv(
	platformName: NodeJS.Platform = process.platform,
): string | null {
	const value =
		platformName === "win32"
			? process.env.USERPROFILE || process.env.HOME
			: process.env.HOME || process.env.USERPROFILE;
	if (!value || value.trim() === "") {
		return null;
	}
	return value.trim();
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
	if (isMacOS()) return PLATFORM_CONCURRENCY.MACOS;
	if (isWindows()) return PLATFORM_CONCURRENCY.WINDOWS;
	return PLATFORM_CONCURRENCY.LINUX;
}
