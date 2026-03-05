/**
 * File operation utilities for directory manipulation during extraction
 */
import { copyFile, lstat, mkdir, readdir } from "node:fs/promises";
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
 * Retry wrapper for file operations that may fail due to Windows AV locking
 * @param fn - Function to retry
 * @param retries - Number of retry attempts (default: 3)
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
	for (let i = 0; i < retries; i++) {
		try {
			return await fn();
		} catch (e) {
			if (!isRetryable(e) || i === retries - 1) throw e;
			await delay(100 * 2 ** i);
		}
	}
	throw new Error("Unreachable");
}

/**
 * Check if error is retryable (Windows AV file locking)
 */
const isRetryable = (e: unknown): boolean => {
	const code = (e as NodeJS.ErrnoException).code ?? "";
	return ["EBUSY", "EPERM", "EACCES"].includes(code);
};

/**
 * Delay helper for retry backoff
 */
const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

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

		// Use lstat to prevent following symlinks
		const entryStat = await lstat(sourcePath);

		if (entryStat.isDirectory()) {
			// Recursively copy directory
			await copyDirectory(sourcePath, destPath, shouldExclude, sizeTracker);
		} else if (entryStat.isFile()) {
			// Track file size and check limit
			if (sizeTracker) {
				sizeTracker.checkExtractionSize(entryStat.size);
			}
			// Copy file with retry for Windows AV locking
			await withRetry(() => copyFile(sourcePath, destPath));
		} else {
			// Reject non-regular files (symlinks, devices, pipes, etc.)
			throw new ExtractionError(`Not a regular file: ${relativePath}`);
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

		// Use lstat to prevent following symlinks
		const entryStat = await lstat(sourcePath);

		if (entryStat.isDirectory()) {
			// Recursively copy directory
			await copyDirectory(sourcePath, destPath, shouldExclude, sizeTracker);
		} else if (entryStat.isFile()) {
			// Track file size and check limit
			if (sizeTracker) {
				sizeTracker.checkExtractionSize(entryStat.size);
			}
			// Copy file with retry for Windows AV locking
			await withRetry(() => copyFile(sourcePath, destPath));
		} else {
			// Reject non-regular files (symlinks, devices, pipes, etc.)
			throw new ExtractionError(`Not a regular file: ${relativePath}`);
		}
	}
}
