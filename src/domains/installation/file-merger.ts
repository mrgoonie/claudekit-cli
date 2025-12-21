/**
 * FileMerger - Facade for file merge operations
 *
 * This module is split into:
 * - merger/file-scanner.ts: File discovery with pattern matching
 * - merger/settings-processor.ts: Settings.json processing and selective merge
 * - merger/copy-executor.ts: File copying with conflict detection
 */

import type { ReleaseManifest } from "@/domains/migration/release-manifest.js";
import { logger } from "@/shared/logger.js";
import { NEVER_COPY_PATTERNS } from "@/types";
import * as clack from "@clack/prompts";
import { CopyExecutor } from "./merger/copy-executor.js";

export class FileMerger {
	private copyExecutor: CopyExecutor;

	constructor() {
		this.copyExecutor = new CopyExecutor(NEVER_COPY_PATTERNS);
	}

	/**
	 * Set include patterns (only files matching these patterns will be processed)
	 */
	setIncludePatterns(patterns: string[]): void {
		this.copyExecutor.setIncludePatterns(patterns);
	}

	/**
	 * Set global flag to enable path variable replacement in settings.json
	 */
	setGlobalFlag(isGlobal: boolean): void {
		this.copyExecutor.setGlobalFlag(isGlobal);
	}

	/**
	 * Set force overwrite settings flag to skip selective merge and fully replace settings.json
	 */
	setForceOverwriteSettings(force: boolean): void {
		this.copyExecutor.setForceOverwriteSettings(force);
	}

	/**
	 * Set release manifest for selective merge optimization
	 * When set, files with matching checksums will be skipped during copy
	 */
	setManifest(manifest: ReleaseManifest | null): void {
		this.copyExecutor.setManifest(manifest);
	}

	/**
	 * Merge files from source to destination with conflict detection
	 */
	async merge(sourceDir: string, destDir: string, skipConfirmation = false): Promise<void> {
		// Get list of files that will be affected
		const conflicts = await this.copyExecutor.detectConflicts(sourceDir, destDir);

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
		await this.copyExecutor.copyFiles(sourceDir, destDir);
	}

	/**
	 * Add custom patterns to never copy (security-sensitive files)
	 */
	addIgnorePatterns(patterns: string[]): void {
		this.copyExecutor.addIgnorePatterns(patterns);
	}

	/**
	 * Get list of installed files (relative paths)
	 * Returns top-level directories + root files for cleaner manifest
	 */
	getInstalledItems(): string[] {
		return this.copyExecutor.getInstalledItems();
	}

	/**
	 * Get all installed files (full relative paths)
	 */
	getAllInstalledFiles(): string[] {
		return this.copyExecutor.getAllInstalledFiles();
	}
}
