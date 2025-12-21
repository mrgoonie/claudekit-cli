/**
 * Path security utilities for archive extraction
 * Prevents path traversal attacks (zip slip) and archive bomb attacks
 */
import { relative, resolve } from "node:path";
import { ExtractionError } from "@/types";

/**
 * Maximum extraction size (500MB) to prevent archive bombs
 */
export const MAX_EXTRACTION_SIZE = 500 * 1024 * 1024; // 500MB

/**
 * Validate path to prevent path traversal attacks (zip slip)
 * @param basePath - The base directory that paths should be contained within
 * @param targetPath - The target path to validate
 * @returns true if path is safe, false if attempting to escape
 */
export function isPathSafe(basePath: string, targetPath: string): boolean {
	// Resolve both paths to their absolute canonical forms
	const resolvedBase = resolve(basePath);
	const resolvedTarget = resolve(targetPath);

	// Calculate relative path from base to target
	const relativePath = relative(resolvedBase, resolvedTarget);

	// If path starts with .. or is absolute, it's trying to escape
	// Also block if relative path is empty but resolved paths differ (edge case)
	return (
		!relativePath.startsWith("..") &&
		!relativePath.startsWith("/") &&
		resolvedTarget.startsWith(resolvedBase)
	);
}

/**
 * Extraction size tracker for archive bomb protection
 */
export class ExtractionSizeTracker {
	private totalExtractedSize = 0;

	/**
	 * Track extracted file size and check against limit
	 * @throws {ExtractionError} if extraction exceeds MAX_EXTRACTION_SIZE
	 */
	checkExtractionSize(fileSize: number): void {
		this.totalExtractedSize += fileSize;
		if (this.totalExtractedSize > MAX_EXTRACTION_SIZE) {
			throw new ExtractionError(
				`Archive exceeds maximum extraction size of ${formatBytes(MAX_EXTRACTION_SIZE)}. Possible archive bomb detected.`,
			);
		}
	}

	/**
	 * Reset extraction size tracker for new extraction
	 */
	reset(): void {
		this.totalExtractedSize = 0;
	}
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 Bytes";

	const k = 1024;
	const sizes = ["Bytes", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
}
