import { join, relative } from "node:path";
import * as clack from "@clack/prompts";
import { copy, lstat, pathExists, readdir } from "fs-extra";
import ignore from "ignore";
import { minimatch } from "minimatch";
import { PROTECTED_PATTERNS } from "../types.js";
import { logger } from "../utils/logger.js";

export class FileMerger {
	private ig = ignore().add(PROTECTED_PATTERNS);
	private includePatterns: string[] = [];

	/**
	 * Set include patterns (only files matching these patterns will be processed)
	 */
	setIncludePatterns(patterns: string[]): void {
		this.includePatterns = patterns;
	}

	/**
	 * Merge files from source to destination with conflict detection
	 */
	async merge(sourceDir: string, destDir: string, skipConfirmation = false): Promise<void> {
		// Get list of files that will be affected
		const conflicts = await this.detectConflicts(sourceDir, destDir);

		if (conflicts.length > 0 && !skipConfirmation) {
			logger.warning(`Found ${conflicts.length} file(s) that will be overwritten:`);
			conflicts.slice(0, 10).forEach((file) => logger.info(`  - ${file}`));
			if (conflicts.length > 10) {
				logger.info(`  ... and ${conflicts.length - 10} more`);
			}

			const confirm = await clack.confirm({
				message: "Do you want to continue?",
			});

			if (clack.isCancel(confirm) || !confirm) {
				throw new Error("Merge cancelled by user");
			}
		}

		// Copy files
		await this.copyFiles(sourceDir, destDir);
	}

	/**
	 * Detect files that will be overwritten
	 * Protected files that exist in destination are not considered conflicts (they won't be overwritten)
	 */
	private async detectConflicts(sourceDir: string, destDir: string): Promise<string[]> {
		const conflicts: string[] = [];
		const files = await this.getFiles(sourceDir, sourceDir);

		for (const file of files) {
			const relativePath = relative(sourceDir, file);
			const destPath = join(destDir, relativePath);

			// Check if file exists in destination
			if (await pathExists(destPath)) {
				// Protected files won't be overwritten, so they're not conflicts
				if (this.ig.ignores(relativePath)) {
					logger.debug(`Protected file exists but won't be overwritten: ${relativePath}`);
					continue;
				}
				conflicts.push(relativePath);
			}
		}

		return conflicts;
	}

	/**
	 * Copy files from source to destination, skipping protected patterns
	 */
	private async copyFiles(sourceDir: string, destDir: string): Promise<void> {
		const files = await this.getFiles(sourceDir, sourceDir);
		let copiedCount = 0;
		let skippedCount = 0;

		for (const file of files) {
			const relativePath = relative(sourceDir, file);
			const destPath = join(destDir, relativePath);

			// Skip protected files ONLY if they already exist in destination
			// This allows new protected files to be added, but prevents overwriting existing ones
			if (this.ig.ignores(relativePath) && (await pathExists(destPath))) {
				logger.debug(`Skipping protected file (exists in destination): ${relativePath}`);
				skippedCount++;
				continue;
			}

			await copy(file, destPath, { overwrite: true });
			copiedCount++;
		}

		logger.success(`Copied ${copiedCount} file(s), skipped ${skippedCount} protected file(s)`);
	}

	/**
	 * Recursively get all files in a directory, respecting include patterns
	 */
	private async getFiles(dir: string, baseDir: string = dir): Promise<string[]> {
		const files: string[] = [];
		const entries = await readdir(dir, { encoding: "utf8" });

		for (const entry of entries) {
			const fullPath = join(dir, entry);
			const relativePath = relative(baseDir, fullPath);

			// Security: Skip symbolic links to prevent directory traversal attacks
			// Use lstat() instead of stat() to detect symlinks before following them
			const stats = await lstat(fullPath);
			if (stats.isSymbolicLink()) {
				logger.warning(`Skipping symbolic link: ${relativePath}`);
				continue;
			}

			// Apply include pattern filtering
			if (this.includePatterns.length > 0) {
				const shouldInclude = this.includePatterns.some((pattern) => {
					// Normalize pattern to support both directory and glob patterns
					const globPattern = pattern.includes("*") ? pattern : `${pattern}/**`;

					// For files: check if they match the glob pattern
					if (!stats.isDirectory()) {
						return minimatch(relativePath, globPattern, { dot: true });
					}

					// For directories: allow traversal if this directory could lead to matching files
					const normalizedPattern = pattern.endsWith("/") ? pattern.slice(0, -1) : pattern;
					const normalizedPath = relativePath.endsWith("/")
						? relativePath.slice(0, -1)
						: relativePath;

					// Allow if pattern starts with this directory path OR directory matches pattern exactly
					return (
						normalizedPattern.startsWith(`${normalizedPath}/`) ||
						normalizedPattern === normalizedPath ||
						minimatch(relativePath, globPattern, { dot: true })
					);
				});

				if (!shouldInclude) {
					continue;
				}
			}

			if (stats.isDirectory()) {
				const subFiles = await this.getFiles(fullPath, baseDir);
				files.push(...subFiles);
			} else {
				files.push(fullPath);
			}
		}

		return files;
	}

	/**
	 * Add custom patterns to ignore
	 */
	addIgnorePatterns(patterns: string[]): void {
		this.ig.add(patterns);
	}
}
