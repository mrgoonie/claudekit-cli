import { dirname, join, relative } from "node:path";
import * as clack from "@clack/prompts";
import { copy, lstat, pathExists, readFile, readdir, writeFile } from "fs-extra";
import ignore from "ignore";
import { minimatch } from "minimatch";
import { NEVER_COPY_PATTERNS, USER_CONFIG_PATTERNS } from "../types.js";
import { logger } from "../utils/logger.js";

export class FileMerger {
	// Files that should NEVER be copied (security-sensitive)
	private neverCopyChecker = ignore().add(NEVER_COPY_PATTERNS);
	// Files that should only be skipped if they already exist (user config)
	private userConfigChecker = ignore().add(USER_CONFIG_PATTERNS);
	private includePatterns: string[] = [];
	private isGlobal = false;
	// Track installed files for manifest
	private installedFiles: Set<string> = new Set();
	private installedDirectories: Set<string> = new Set();

	/**
	 * Set include patterns (only files matching these patterns will be processed)
	 */
	setIncludePatterns(patterns: string[]): void {
		this.includePatterns = patterns;
	}

	/**
	 * Set global flag to enable path variable replacement in settings.json
	 */
	setGlobalFlag(isGlobal: boolean): void {
		this.isGlobal = isGlobal;
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
			// Normalize to forward slashes for consistent pattern matching on all platforms
			const normalizedRelativePath = relativePath.replace(/\\/g, "/");
			const destPath = join(destDir, relativePath);

			// Check if file exists in destination
			if (await pathExists(destPath)) {
				// Security-sensitive files are never copied, so never conflicts
				if (this.neverCopyChecker.ignores(normalizedRelativePath)) {
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
	private async copyFiles(sourceDir: string, destDir: string): Promise<void> {
		const files = await this.getFiles(sourceDir, sourceDir);
		let copiedCount = 0;
		let skippedCount = 0;

		for (const file of files) {
			const relativePath = relative(sourceDir, file);
			// Normalize to forward slashes for consistent pattern matching on all platforms
			const normalizedRelativePath = relativePath.replace(/\\/g, "/");
			const destPath = join(destDir, relativePath);

			// Tier 1: Never copy security-sensitive files (.env, *.key, etc.)
			// These should NEVER be copied from source to destination for security
			// Use .example template files for initialization instead
			if (this.neverCopyChecker.ignores(normalizedRelativePath)) {
				logger.debug(`Skipping security-sensitive file: ${normalizedRelativePath}`);
				skippedCount++;
				continue;
			}

			// Tier 2: Skip user config files (.gitignore, .mcp.json, etc.) ONLY if they already exist
			// On first installation, these should be copied; on updates, preserve user's version
			if (this.userConfigChecker.ignores(normalizedRelativePath)) {
				const fileExists = await pathExists(destPath);
				if (fileExists) {
					logger.debug(`Skipping existing user config file: ${normalizedRelativePath}`);
					skippedCount++;
					continue;
				}
				logger.debug(`Copying user config file (first-time setup): ${normalizedRelativePath}`);
			}

			// Special handling for settings.json - convert env var syntax for cross-platform
			if (normalizedRelativePath === "settings.json") {
				await this.processSettingsJson(file, destPath);
				this.trackInstalledFile(normalizedRelativePath);
				copiedCount++;
				continue;
			}

			await copy(file, destPath, { overwrite: true });
			this.trackInstalledFile(normalizedRelativePath);
			copiedCount++;
		}

		logger.success(`Copied ${copiedCount} file(s), skipped ${skippedCount} protected file(s)`);
	}

	/**
	 * Process settings.json file and convert Unix-style env vars to Windows syntax
	 *
	 * Cross-platform compatibility:
	 * - Global mode: $CLAUDE_PROJECT_DIR → $HOME (Unix) or %USERPROFILE% (Windows)
	 * - Local mode on Windows: $VAR → %VAR% (convert syntax only)
	 * - Local mode on Unix: No changes needed
	 */
	private async processSettingsJson(sourceFile: string, destFile: string): Promise<void> {
		try {
			// Read the settings.json content
			const content = await readFile(sourceFile, "utf-8");
			const isWindows = process.platform === "win32";
			let processedContent = content;

			if (this.isGlobal) {
				// Global mode: Replace $CLAUDE_PROJECT_DIR with home directory
				const homeVar = isWindows ? "%USERPROFILE%" : "$HOME";
				processedContent = content.replace(/\$CLAUDE_PROJECT_DIR/g, homeVar);

				if (processedContent !== content) {
					logger.debug(
						`Replaced $CLAUDE_PROJECT_DIR with ${homeVar} in settings.json for global installation`,
					);
				}
			} else if (isWindows) {
				// Local mode on Windows: Convert $VAR syntax to %VAR% syntax
				// $CLAUDE_PROJECT_DIR → %CLAUDE_PROJECT_DIR%
				// $HOME → %USERPROFILE%
				processedContent = content
					.replace(/\$CLAUDE_PROJECT_DIR/g, "%CLAUDE_PROJECT_DIR%")
					.replace(/\$HOME/g, "%USERPROFILE%");

				if (processedContent !== content) {
					logger.debug("Converted Unix env var syntax to Windows syntax in settings.json");
				}
			}
			// Local mode on Unix: No changes needed, $CLAUDE_PROJECT_DIR works as-is

			// Write the processed content to destination
			await writeFile(destFile, processedContent, "utf-8");
		} catch (error) {
			logger.error(`Failed to process settings.json: ${error}`);
			// Fallback to direct copy if processing fails
			await copy(sourceFile, destFile, { overwrite: true });
		}
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
			// Normalize to forward slashes for consistent pattern matching on all platforms
			const normalizedRelativePath = relativePath.replace(/\\/g, "/");

			// Security: Skip symbolic links to prevent directory traversal attacks
			// Use lstat() instead of stat() to detect symlinks before following them
			const stats = await lstat(fullPath);
			if (stats.isSymbolicLink()) {
				logger.warning(`Skipping symbolic link: ${normalizedRelativePath}`);
				continue;
			}

			// Apply include pattern filtering
			if (this.includePatterns.length > 0) {
				const shouldInclude = this.includePatterns.some((pattern) => {
					// Normalize pattern to support both directory and glob patterns
					const globPattern = pattern.includes("*") ? pattern : `${pattern}/**`;

					// For files: check if they match the glob pattern
					if (!stats.isDirectory()) {
						return minimatch(normalizedRelativePath, globPattern, { dot: true });
					}

					// For directories: allow traversal if this directory could lead to matching files
					const normalizedPattern = pattern.endsWith("/") ? pattern.slice(0, -1) : pattern;
					const normalizedPath = normalizedRelativePath.endsWith("/")
						? normalizedRelativePath.slice(0, -1)
						: normalizedRelativePath;

					// Allow if pattern starts with this directory path OR directory matches pattern exactly
					return (
						normalizedPattern.startsWith(`${normalizedPath}/`) ||
						normalizedPattern === normalizedPath ||
						minimatch(normalizedRelativePath, globPattern, { dot: true })
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
	 * Add custom patterns to never copy (security-sensitive files)
	 */
	addIgnorePatterns(patterns: string[]): void {
		this.neverCopyChecker.add(patterns);
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
