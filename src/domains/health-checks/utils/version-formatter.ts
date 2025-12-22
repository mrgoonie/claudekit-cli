/**
 * Format version string - ensure single 'v' prefix
 */
export function formatVersion(version: string | undefined): string {
	if (!version) return "";
	// Remove leading 'v' if present, then add it back consistently
	return `v${version.replace(/^v/, "")}`;
}
