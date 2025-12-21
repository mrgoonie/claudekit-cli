/**
 * File operation utilities for directory manipulation during extraction
 */
import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { logger } from "@/shared/logger.js";
import { ExtractionError } from "@/types";
import type { ExtractionSizeTracker } from "./path-security.js";
import { isPathSafe } from "./path-security.js";

/**
 * Exclusion filter function type
 */
export type ExclusionFilter = (filePath: string) => boolean;

/**
 * Move directory contents from source to destination, applying exclusion filters
 * @param sourceDir - Source directory path
 * @param destDir - Destination directory path
 * @param shouldExclude - Function to check if path should be excluded
 * @param sizeTracker - Optional extraction size tracker for archive bomb protection
 */
export async function moveDirectoryContents(
	sourceDir: string,
	destDir: string,
	shouldExclude: ExclusionFilter,
	sizeTracker?: ExtractionSizeTracker,
): Promise<void> {
	await mkdir(destDir, { recursive: true });

	const entries = await readdir(sourceDir, { encoding: "utf8" });

	for (const entry of entries) {
		const sourcePath = join(sourceDir, entry);
		const destPath = join(destDir, entry);
		const relativePath = relative(sourceDir, sourcePath);

		// Validate path safety (prevent path traversal)
		if (!isPathSafe(destDir, destPath)) {
			logger.warning(`Skipping unsafe path: ${relativePath}`);
			throw new ExtractionError(`Path traversal attempt detected: ${relativePath}`);
		}

		// Skip excluded files
		if (shouldExclude(relativePath)) {
			logger.debug(`Excluding: ${relativePath}`);
			continue;
		}

		const entryStat = await stat(sourcePath);

		if (entryStat.isDirectory()) {
			// Recursively copy directory
			await copyDirectory(sourcePath, destPath, shouldExclude, sizeTracker);
		} else {
			// Track file size and check limit
			if (sizeTracker) {
				sizeTracker.checkExtractionSize(entryStat.size);
			}
			// Copy file
			await copyFile(sourcePath, destPath);
		}
	}
}

/**
 * Recursively copy directory with exclusion filtering
 * @param sourceDir - Source directory path
 * @param destDir - Destination directory path
 * @param shouldExclude - Function to check if path should be excluded
 * @param sizeTracker - Optional extraction size tracker for archive bomb protection
 */
export async function copyDirectory(
	sourceDir: string,
	destDir: string,
	shouldExclude: ExclusionFilter,
	sizeTracker?: ExtractionSizeTracker,
): Promise<void> {
	await mkdir(destDir, { recursive: true });

	const entries = await readdir(sourceDir, { encoding: "utf8" });

	for (const entry of entries) {
		const sourcePath = join(sourceDir, entry);
		const destPath = join(destDir, entry);
		const relativePath = relative(sourceDir, sourcePath);

		// Validate path safety (prevent path traversal)
		if (!isPathSafe(destDir, destPath)) {
			logger.warning(`Skipping unsafe path: ${relativePath}`);
			throw new ExtractionError(`Path traversal attempt detected: ${relativePath}`);
		}

		// Skip excluded files
		if (shouldExclude(relativePath)) {
			logger.debug(`Excluding: ${relativePath}`);
			continue;
		}

		const entryStat = await stat(sourcePath);

		if (entryStat.isDirectory()) {
			// Recursively copy directory
			await copyDirectory(sourcePath, destPath, shouldExclude, sizeTracker);
		} else {
			// Track file size and check limit
			if (sizeTracker) {
				sizeTracker.checkExtractionSize(entryStat.size);
			}
			// Copy file
			await copyFile(sourcePath, destPath);
		}
	}
}
