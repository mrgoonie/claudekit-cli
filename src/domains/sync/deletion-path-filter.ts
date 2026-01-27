/**
 * Deletion path filter for sync operations.
 * Filters tracked files matching deletion patterns to prevent
 * spurious "Skipping invalid path" warnings during upgrades.
 */
import { PathResolver } from "@/shared/path-resolver.js";
import type { TrackedFile } from "@/types";
import picomatch from "picomatch";

/**
 * Filter tracked files, excluding those matching deletion patterns.
 * Used to prevent "Skipping invalid path" warnings for files
 * that are intentionally deleted in the new release.
 *
 * @param trackedFiles - Files tracked in user's metadata
 * @param deletions - Deletion patterns (exact paths or globs)
 * @returns Filtered array of tracked files
 */
export function filterDeletionPaths(
	trackedFiles: TrackedFile[],
	deletions: string[] | undefined,
): TrackedFile[] {
	if (!deletions || deletions.length === 0) {
		return trackedFiles;
	}

	// Build matchers for glob patterns
	const exactPaths = new Set<string>();
	const globMatchers: ((path: string) => boolean)[] = [];

	for (const pattern of deletions) {
		if (PathResolver.isGlobPattern(pattern)) {
			globMatchers.push(picomatch(pattern));
		} else {
			exactPaths.add(pattern);
		}
	}

	return trackedFiles.filter((file) => {
		// Check exact match
		if (exactPaths.has(file.path)) return false;
		// Check glob patterns
		for (const matcher of globMatchers) {
			if (matcher(file.path)) return false;
		}
		return true;
	});
}
