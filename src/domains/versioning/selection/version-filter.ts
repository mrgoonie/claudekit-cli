/**
 * Version filtering and validation logic
 */

/** Matches semantic versions like v1.2.3 or 1.2.3 (with optional prerelease suffix) */
export const VERSION_PATTERN = /^v?\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;

/**
 * Validate version string format
 * @param version - Version string to validate
 * @returns true if valid semantic version format
 */
export function isValidVersionFormat(version: string): boolean {
	const trimmed = version.trim();
	if (!trimmed) return false;
	return VERSION_PATTERN.test(trimmed);
}

/**
 * Normalize version tag to include 'v' prefix
 * @param version - Version string to normalize
 * @returns Version with 'v' prefix
 */
export function normalizeVersionTag(version: string): string {
	const trimmed = version.trim();
	return trimmed.startsWith("v") ? trimmed : `v${trimmed}`;
}
