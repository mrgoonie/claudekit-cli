/**
 * Shared version utilities for version checkers
 */

export interface VersionCheckResult {
	currentVersion: string;
	latestVersion: string;
	updateAvailable: boolean;
	releaseUrl: string;
}

/**
 * Check if environment disables update notifications
 * Shared utility for all version checkers
 * @internal Exported for testing
 */
export function isUpdateCheckDisabled(): boolean {
	return (
		process.env.NO_UPDATE_NOTIFIER === "1" ||
		process.env.NO_UPDATE_NOTIFIER === "true" ||
		!process.stdout.isTTY // Not a terminal (CI/CD)
	);
}

/**
 * Normalize version tag (strip 'v' prefix)
 * Shared utility for all version checkers
 * @internal Exported for testing
 */
export function normalizeVersion(version: string): string {
	return version.replace(/^v/, "");
}
