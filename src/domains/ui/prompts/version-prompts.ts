/**
 * Version Prompts
 *
 * Prompts for version selection with GitHub API integration
 */

import {
	VersionSelector,
	type VersionSelectorOptions,
} from "@/domains/versioning/version-selector.js";
import { isCancel, select } from "@/shared/safe-prompts.js";
import type { KitConfig } from "@/types";

/**
 * Prompt user to select a version (basic version for backward compatibility)
 */
export async function selectVersion(versions: string[], defaultVersion?: string): Promise<string> {
	if (versions.length === 0) {
		throw new Error("No versions available");
	}

	// If only one version or default is latest, return first version
	if (versions.length === 1 || !defaultVersion) {
		return versions[0];
	}

	const version = await select({
		message: "Select a version:",
		options: versions.map((v) => ({
			value: v,
			label: v,
		})),
		initialValue: defaultVersion,
	});

	if (isCancel(version)) {
		throw new Error("Version selection cancelled");
	}

	return version as string;
}

/**
 * Enhanced version selection with GitHub API integration
 */
export async function selectVersionEnhanced(
	options: VersionSelectorOptions,
): Promise<string | null> {
	const selector = new VersionSelector();
	return await selector.selectVersion(options);
}

/**
 * Get latest version without prompting
 */
export async function getLatestVersion(
	kit: KitConfig,
	includePrereleases = false,
): Promise<string | null> {
	const selector = new VersionSelector();
	return await selector.getLatestVersion(kit, includePrereleases);
}
