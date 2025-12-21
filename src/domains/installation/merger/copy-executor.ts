import { dirname, join, relative } from "node:path";
import type { ReleaseManifest } from "@/domains/migration/release-manifest.js";
import { logger } from "@/shared/logger.js";
import { USER_CONFIG_PATTERNS } from "@/types";
import { copy, pathExists } from "fs-extra";
import ignore, { type Ignore } from "ignore";
import { SelectiveMerger } from "../selective-merger.js";
import { FileScanner } from "./file-scanner.js";
import { SettingsProcessor } from "./settings-processor.js";

/**
 * CopyExecutor handles file copying with conflict detection and selective merge
 */
export class CopyExecutor {
	private userConfigChecker: Ignore;
	private fileScanner: FileScanner;
	private settingsProcessor: SettingsProcessor;
	private selectiveMerger: SelectiveMerger | null = null;
	private unchangedSkipped = 0;
	// Track installed files for manifest
	private installedFiles: Set<string> = new Set();
	private installedDirectories: Set<string> = new Set();

	constructor(neverCopyPatterns: string[]) {
		this.userConfigChecker = ignore().add(USER_CONFIG_PATTERNS);
		this.fileScanner = new FileScanner(neverCopyPatterns);
		this.settingsProcessor = new SettingsProcessor();
	}

	/**
	 * Set include patterns (only files matching these patterns will be processed)
	 */
	setIncludePatterns(patterns: string[]): void {
		this.fileScanner.setIncludePatterns(patterns);
	}

	/**
	 * Set global flag to enable path variable replacement in settings.json
	 */
	setGlobalFlag(isGlobal: boolean): void {
		this.settingsProcessor.setGlobalFlag(isGlobal);
	}

	/**
	 * Set force overwrite settings flag to skip selective merge
	 */
	setForceOverwriteSettings(force: boolean): void {
		this.settingsProcessor.setForceOverwriteSettings(force);
	}

	/**
	 * Set release manifest for selective merge optimization
	 */
	setManifest(manifest: ReleaseManifest | null): void {
		this.selectiveMerger = manifest ? new SelectiveMerger(manifest) : null;
		if (manifest && this.selectiveMerger?.hasManifest()) {
			logger.debug(
				`Selective merge enabled with ${this.selectiveMerger.getManifestFileCount()} tracked files`,
			);
		}
	}

	/**
	 * Add custom patterns to never copy (security-sensitive files)
	 */
	addIgnorePatterns(patterns: string[]): void {
		this.fileScanner.addIgnorePatterns(patterns);
	}

	/**
	 * Get files in a directory
	 */
	async getFiles(dir: string, baseDir?: string): Promise<string[]> {
		return this.fileScanner.getFiles(dir, baseDir);
	}

	/**
	 * Detect files that will be overwritten
	 * Protected files that exist in destination are not considered conflicts
	 */
	async detectConflicts(sourceDir: string, destDir: string): Promise<string[]> {
		const conflicts: string[] = [];
		const files = await this.fileScanner.getFiles(sourceDir, sourceDir);

		for (const file of files) {
			const relativePath = relative(sourceDir, file);
			// Normalize to forward slashes for consistent pattern matching on all platforms
			const normalizedRelativePath = relativePath.replace(/\\/g, "/");
			const destPath = join(destDir, relativePath);

			// Check if file exists in destination
			if (await pathExists(destPath)) {
				// Security-sensitive files are never copied, so never conflicts
				if (this.fileScanner.shouldNeverCopy(normalizedRelativePath)) {
					logger.debug(
						`Security-sensitive file exists but won't be overwritten: ${normalizedRelativePath}`,
					);
					continue;
				}
				// User config files existing in destination won't be overwritten, so not conflicts
				if (this.userConfigChecker.ignores(normalizedRelativePath)) {
					logger.debug(`User config file exists and will be preserved: ${normalizedRelativePath}`);
					continue;
				}
				conflicts.push(normalizedRelativePath);
			}
		}

		return conflicts;
	}

	/**
	 * Copy files from source to destination, skipping protected patterns
	 */
	async copyFiles(sourceDir: string, destDir: string): Promise<void> {
		const files = await this.fileScanner.getFiles(sourceDir, sourceDir);
		let copiedCount = 0;
		let skippedCount = 0;

		for (const file of files) {
			const relativePath = relative(sourceDir, file);
			// Normalize to forward slashes for consistent pattern matching on all platforms
			const normalizedRelativePath = relativePath.replace(/\\/g, "/");
			const destPath = join(destDir, relativePath);

			// Tier 1: Never copy security-sensitive files (.env, *.key, etc.)
			if (this.fileScanner.shouldNeverCopy(normalizedRelativePath)) {
				logger.debug(`Skipping security-sensitive file: ${normalizedRelativePath}`);
				skippedCount++;
				continue;
			}

			// Tier 2: Skip user config files ONLY if they already exist
			if (this.userConfigChecker.ignores(normalizedRelativePath)) {
				const fileExists = await pathExists(destPath);
				if (fileExists) {
					logger.debug(`Preserving user config: ${normalizedRelativePath}`);
					skippedCount++;
					continue;
				}
				logger.debug(`Copying user config (first-time): ${normalizedRelativePath}`);
			}

			// Special handling for settings.json
			if (
				normalizedRelativePath === "settings.json" ||
				normalizedRelativePath === ".claude/settings.json"
			) {
				await this.settingsProcessor.processSettingsJson(file, destPath);
				this.trackInstalledFile(normalizedRelativePath);
				copiedCount++;
				continue;
			}

			// Tier 3: Selective merge optimization - skip unchanged files
			if (this.selectiveMerger?.hasManifest()) {
				const compareResult = await this.selectiveMerger.shouldCopyFile(
					destPath,
					normalizedRelativePath,
				);
				if (!compareResult.changed) {
					logger.debug(`Skipping unchanged: ${normalizedRelativePath}`);
					this.unchangedSkipped++;
					this.trackInstalledFile(normalizedRelativePath);
					continue;
				}
			}

			await copy(file, destPath, { overwrite: true });
			this.trackInstalledFile(normalizedRelativePath);
			copiedCount++;
		}

		// Build success message with selective merge stats
		if (this.unchangedSkipped > 0) {
			logger.success(
				`Updated ${copiedCount} file(s), skipped ${this.unchangedSkipped} unchanged, skipped ${skippedCount} protected`,
			);
		} else {
			logger.success(`Copied ${copiedCount} file(s), skipped ${skippedCount} protected file(s)`);
		}
	}

	/**
	 * Get list of installed files (relative paths)
	 * Returns top-level directories + root files for cleaner manifest
	 */
	getInstalledItems(): string[] {
		// Collect top-level directories and root files
		const topLevelItems = new Set<string>();

		for (const file of this.installedFiles) {
			// Get the top-level directory or file
			const parts = file.split("/");
			if (parts.length > 1) {
				// It's in a subdirectory, add the top-level dir
				topLevelItems.add(`${parts[0]}/`);
			} else {
				// It's a root file
				topLevelItems.add(file);
			}
		}

		return Array.from(topLevelItems).sort();
	}

	/**
	 * Get all installed files (full relative paths)
	 */
	getAllInstalledFiles(): string[] {
		return Array.from(this.installedFiles).sort();
	}

	/**
	 * Track a file as installed
	 */
	private trackInstalledFile(relativePath: string): void {
		this.installedFiles.add(relativePath);

		// Also track parent directories
		let dir = dirname(relativePath);
		while (dir && dir !== "." && dir !== "/") {
			this.installedDirectories.add(`${dir}/`);
			dir = dirname(dir);
		}
	}
}
