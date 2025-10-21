import { join, relative } from "node:path";
import * as clack from "@clack/prompts";
import { copy, pathExists, readdir, stat } from "fs-extra";
import ignore from "ignore";
import { PROTECTED_PATTERNS } from "../types.js";
import { logger } from "../utils/logger.js";

export class FileMerger {
	private ig = ignore().add(PROTECTED_PATTERNS);

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
		const files = await this.getFiles(sourceDir);

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
		const files = await this.getFiles(sourceDir);
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
	 * Recursively get all files in a directory
	 */
	private async getFiles(dir: string): Promise<string[]> {
		const files: string[] = [];
		const entries = await readdir(dir, { encoding: "utf8" });

		for (const entry of entries) {
			const fullPath = join(dir, entry);
			const stats = await stat(fullPath);

			if (stats.isDirectory()) {
				const subFiles = await this.getFiles(fullPath);
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
