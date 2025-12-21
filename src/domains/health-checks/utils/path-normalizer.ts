import { normalize } from "node:path";

/**
 * Normalize path for case-insensitive filesystem comparison.
 * On Windows/macOS, paths with different casing refer to the same file.
 */
export function normalizePath(filePath: string): string {
	// First normalize path separators and resolve path structure
	const normalized = normalize(filePath);

	// Normalize to lowercase on case-insensitive filesystems (Windows, macOS)
	const isCaseInsensitive = process.platform === "win32" || process.platform === "darwin";
	return isCaseInsensitive ? normalized.toLowerCase() : normalized;
}
