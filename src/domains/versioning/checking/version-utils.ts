/**
 * Shared version utilities for version checkers
 */
import { compareVersions } from "compare-versions";

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

/**
 * Extract base version and prerelease info from a version string
 * e.g., "3.31.0-dev.7" → { base: "3.31.0", prerelease: "dev.7" }
 * e.g., "3.31.0" → { base: "3.31.0", prerelease: null }
 * @internal Exported for testing
 */
export function parseVersionParts(version: string): { base: string; prerelease: string | null } {
	const normalized = normalizeVersion(version);
	const [base, ...prereleaseParts] = normalized.split("-");
	return {
		base,
		prerelease: prereleaseParts.length > 0 ? prereleaseParts.join("-") : null,
	};
}

/**
 * Check if current version is a dev prerelease of the same base as latest stable
 * e.g., current="3.31.0-dev.7", latest="3.31.0" → true (suppress update)
 * e.g., current="3.31.0-dev.7", latest="3.32.0" → false (show update)
 * @internal Exported for testing
 */
export function isDevPrereleaseOfSameBase(currentVersion: string, latestVersion: string): boolean {
	const current = parseVersionParts(currentVersion);
	const latest = parseVersionParts(latestVersion);

	// Only suppress if current is a dev prerelease AND latest is stable (no prerelease)
	// AND they share the same base version
	if (!current.prerelease?.startsWith("dev")) return false;
	if (latest.prerelease !== null) return false;

	return current.base === latest.base;
}

/**
 * Compare two version strings
 * Returns: true if latestVersion > currentVersion
 * Handles special case: dev prereleases comparing to same base stable version
 * @internal Exported for testing
 */
export function isNewerVersion(currentVersion: string, latestVersion: string): boolean {
	try {
		const current = normalizeVersion(currentVersion);
		const latest = normalizeVersion(latestVersion);

		// Special case: don't show update if on dev prerelease of same base version
		// e.g., 3.31.0-dev.7 should NOT prompt to "update" to 3.31.0
		if (isDevPrereleaseOfSameBase(current, latest)) {
			return false;
		}

		return compareVersions(latest, current) > 0;
	} catch {
		return false;
	}
}
