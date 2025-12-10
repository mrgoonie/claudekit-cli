import { dirname, join, relative } from "node:path";
import { type SettingsJson, SettingsMerger } from "@/domains/config/settings-merger.js";
import { logger } from "@/shared/logger.js";
import { NEVER_COPY_PATTERNS, USER_CONFIG_PATTERNS } from "@/types";
import * as clack from "@clack/prompts";
import { copy, lstat, pathExists, readFile, readdir, writeFile } from "fs-extra";
import ignore from "ignore";
import { minimatch } from "minimatch";

export class FileMerger {
	// Files that should NEVER be copied (security-sensitive)
	private neverCopyChecker = ignore().add(NEVER_COPY_PATTERNS);
	// Files that should only be skipped if they already exist (user config)
	private userConfigChecker = ignore().add(USER_CONFIG_PATTERNS);
	private includePatterns: string[] = [];
	private isGlobal = false;
	private forceOverwriteSettings = false;
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
	 * Set force overwrite settings flag to skip selective merge and fully replace settings.json
	 */
	setForceOverwriteSettings(force: boolean): void {
		this.forceOverwriteSettings = force;
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
			// Handle both source structures:
			// - Global install: source has "settings.json" at root (from github release archive)
			// - Local install: source has ".claude/settings.json" (from extracted archive)
			if (
				normalizedRelativePath === "settings.json" ||
				normalizedRelativePath === ".claude/settings.json"
			) {
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
	 * Process settings.json file with selective merge and path transformation
	 *
	 * Merge strategy (when destination exists and not force overwrite):
	 * - hooks: Merge arrays, deduplicate by command string, user hooks preserved
	 * - mcp.servers: Preserve user servers, add new CK servers
	 * - Other keys: CK-managed keys replace, user-only keys preserved
	 *
	 * Path transformation rules:
	 * - Global mode: .claude/ → $HOME/.claude/ (Unix) or %USERPROFILE%/.claude/ (Windows)
	 * - Local mode: .claude/ → "$CLAUDE_PROJECT_DIR"/.claude/ (Unix) or "%CLAUDE_PROJECT_DIR%"/.claude/ (Windows)
	 *
	 * This enables monorepo support where users can start Claude sessions from subdirectories
	 * while hooks/statusline scripts resolve correctly relative to where .claude/ exists.
	 */
	private async processSettingsJson(sourceFile: string, destFile: string): Promise<void> {
		try {
			// Read the source settings.json content
			const sourceContent = await readFile(sourceFile, "utf-8");
			const isWindows = process.platform === "win32";

			// Transform paths in source content first
			let transformedSource = sourceContent;
			if (this.isGlobal) {
				const homeVar = isWindows ? '"%USERPROFILE%"' : '"$HOME"';
				transformedSource = this.transformClaudePaths(sourceContent, homeVar);
				if (transformedSource !== sourceContent) {
					logger.debug(
						`Transformed .claude/ paths to ${homeVar}/.claude/ in settings.json for global installation`,
					);
				}
			} else {
				const projectDirVar = isWindows ? '"%CLAUDE_PROJECT_DIR%"' : '"$CLAUDE_PROJECT_DIR"';
				transformedSource = this.transformClaudePaths(sourceContent, projectDirVar);
				if (transformedSource !== sourceContent) {
					logger.debug(
						`Transformed .claude/ paths to ${projectDirVar}/.claude/ in settings.json for local installation`,
					);
				}
			}

			// Check if destination exists and selective merge should be applied
			const destExists = await pathExists(destFile);

			if (destExists && !this.forceOverwriteSettings) {
				// Selective merge: preserve user customizations
				await this.selectiveMergeSettings(transformedSource, destFile);
			} else {
				// Full overwrite (new install or --force-overwrite-settings)
				await writeFile(destFile, transformedSource, "utf-8");
				if (this.forceOverwriteSettings && destExists) {
					logger.debug("Force overwrite enabled, replaced settings.json completely");
				}
			}
		} catch (error) {
			logger.error(`Failed to process settings.json: ${error}`);
			// Fallback to direct copy if processing fails
			await copy(sourceFile, destFile, { overwrite: true });
		}
	}

	/**
	 * Perform selective merge of settings.json preserving user customizations
	 */
	private async selectiveMergeSettings(
		transformedSourceContent: string,
		destFile: string,
	): Promise<void> {
		// Parse source settings
		let sourceSettings: SettingsJson;
		try {
			sourceSettings = JSON.parse(transformedSourceContent) as SettingsJson;
		} catch {
			logger.warning("Failed to parse source settings.json, falling back to overwrite");
			await writeFile(destFile, transformedSourceContent, "utf-8");
			return;
		}

		// Read existing destination settings
		const destSettings = await SettingsMerger.readSettingsFile(destFile);
		if (!destSettings) {
			// Destination doesn't exist or is invalid, just write source
			await writeFile(destFile, transformedSourceContent, "utf-8");
			return;
		}

		// Perform selective merge (atomic write ensures data integrity without backup files)
		const mergeResult = SettingsMerger.merge(sourceSettings, destSettings);

		// Log merge results
		if (mergeResult.hooksAdded > 0) {
			logger.debug(`Added ${mergeResult.hooksAdded} new hook(s)`);
		}
		if (mergeResult.hooksPreserved > 0) {
			logger.debug(`Preserved ${mergeResult.hooksPreserved} existing hook(s)`);
		}
		if (mergeResult.mcpServersPreserved > 0) {
			logger.debug(`Preserved ${mergeResult.mcpServersPreserved} MCP server(s)`);
		}
		if (mergeResult.conflictsDetected.length > 0) {
			logger.warning(
				`Duplicate hooks detected (skipped): ${mergeResult.conflictsDetected.join(", ")}`,
			);
		}

		// Write merged settings
		await SettingsMerger.writeSettingsFile(destFile, mergeResult.merged);
		logger.success("Merged settings.json (user customizations preserved)");
	}

	/**
	 * Transform relative .claude/ paths to use a prefix variable
	 *
	 * @param content - The file content to transform
	 * @param prefix - The environment variable prefix (e.g., '"$HOME"', '"%USERPROFILE%"')
	 * @returns Transformed content with paths prefixed
	 *
	 * @example
	 * // Global mode (Linux)
	 * transformClaudePaths('node .claude/hooks/test.cjs', '"$HOME"')
	 * // Returns: 'node "$HOME"/.claude/hooks/test.cjs'
	 *
	 * Handles patterns like:
	 * - "node .claude/hooks/..." → "node \"$PREFIX\"/.claude/hooks/..."
	 * - "node ./.claude/hooks/..." → "node \"$PREFIX\"/.claude/hooks/..."
	 *
	 * The quotes around the env var are escaped for JSON and ensure paths with
	 * spaces work correctly when the shell expands the variable.
	 *
	 * LIMITATIONS:
	 * - Only transforms `node` command invocations (not python, bun, sh, etc.)
	 * - Won't transform commands like `cd .claude && node ...` or `./.claude/script.sh`
	 * - This is intentional: ClaudeKit hooks are Node.js scripts executed via `node`
	 *
	 * If you need to support other command patterns, extend the regex in this method.
	 *
	 * @throws Error if content contains potentially unsafe shell metacharacters in .claude/ paths
	 */
	private transformClaudePaths(content: string, prefix: string): string {
		// Security: Validate that .claude/ paths don't contain shell injection attempts
		// Matches dangerous chars after .claude/ but before whitespace or quote
		if (/\.claude\/[^\s"']*[;`$&|><]/.test(content)) {
			logger.warning("Potentially unsafe characters detected in .claude/ paths");
			throw new Error("Settings file contains potentially unsafe path characters");
		}

		let transformed = content;

		// Escape quotes for JSON if prefix contains quotes
		// e.g., "$CLAUDE_PROJECT_DIR" → \"$CLAUDE_PROJECT_DIR\"
		// e.g., "$HOME" → \"$HOME\"
		const jsonSafePrefix = prefix.includes('"') ? prefix.replace(/"/g, '\\"') : prefix;

		// Extract raw env var (without quotes) for path value replacements
		// e.g., "$HOME" → $HOME, "%USERPROFILE%" → %USERPROFILE%
		const rawPrefix = prefix.replace(/"/g, "");

		// Pattern 1: "node .claude/" or "node ./.claude/" - common hook command pattern
		// Matches: "node .claude/..." or "node ./.claude/..."
		// Uses jsonSafePrefix to preserve quotes for shell command execution
		transformed = transformed.replace(
			/(node\s+)(?:\.\/)?\.claude\//g,
			`$1${jsonSafePrefix}/.claude/`,
		);

		// Pattern 2: Already has $CLAUDE_PROJECT_DIR - replace with appropriate prefix
		// This handles templates that already use the variable (path values, not commands)
		// Uses rawPrefix because path values don't need shell quoting
		if (rawPrefix.includes("HOME") || rawPrefix.includes("USERPROFILE")) {
			// Global mode: $CLAUDE_PROJECT_DIR → $HOME or %USERPROFILE%
			transformed = transformed.replace(/\$CLAUDE_PROJECT_DIR/g, rawPrefix);
			transformed = transformed.replace(/%CLAUDE_PROJECT_DIR%/g, rawPrefix);
		}

		return transformed;
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
