import { InstalledSettingsTracker } from "@/domains/config/installed-settings-tracker.js";
import { type SettingsJson, SettingsMerger } from "@/domains/config/settings-merger.js";
import { isWindows } from "@/shared/environment.js";
import { logger } from "@/shared/logger.js";
import type { InstalledSettings } from "@/types";
import { copy, pathExists, readFile, writeFile } from "fs-extra";

/**
 * SettingsProcessor handles settings.json processing with selective merge and path transformation
 */
export class SettingsProcessor {
	private isGlobal = false;
	private forceOverwriteSettings = false;
	private projectDir = "";
	private kitName = "engineer";
	private tracker: InstalledSettingsTracker | null = null;
	private installingKit: string | undefined;

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
	 * Set project directory for settings tracking
	 */
	setProjectDir(dir: string): void {
		this.projectDir = dir;
		this.initTracker();
	}

	/**
	 * Set kit name for settings tracking
	 */
	setKitName(kit: string): void {
		this.kitName = kit;
		this.initTracker();
	}

	/**
	 * Set the kit being installed for hook origin tracking
	 */
	setInstallingKit(kit: string): void {
		this.installingKit = kit;
	}

	/**
	 * Initialize the settings tracker
	 */
	private initTracker(): void {
		if (this.projectDir) {
			this.tracker = new InstalledSettingsTracker(this.projectDir, this.isGlobal, this.kitName);
		}
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
	 */
	async processSettingsJson(sourceFile: string, destFile: string): Promise<void> {
		try {
			// Read the source settings.json content
			const sourceContent = await readFile(sourceFile, "utf-8");

			// Transform paths in source content first
			let transformedSource = sourceContent;
			if (this.isGlobal) {
				const homeVar = isWindows() ? '"%USERPROFILE%"' : '"$HOME"';
				transformedSource = this.transformClaudePaths(sourceContent, homeVar);
				if (transformedSource !== sourceContent) {
					logger.debug(
						`Transformed .claude/ paths to ${homeVar}/.claude/ in settings.json for global installation`,
					);
				}
			} else {
				const projectDirVar = isWindows() ? '"%CLAUDE_PROJECT_DIR%"' : '"$CLAUDE_PROJECT_DIR"';
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
				// Re-format to ensure consistent 2-space indentation
				const formattedContent = this.formatJsonContent(transformedSource);
				await writeFile(destFile, formattedContent, "utf-8");

				// Track what we installed and clear previous tracking if force-overwrite
				try {
					const parsedSettings = JSON.parse(formattedContent) as SettingsJson;
					if (this.forceOverwriteSettings && destExists) {
						logger.debug("Force overwrite enabled, replaced settings.json completely");
						// Clear and rebuild tracking since we're overwriting everything
						if (this.tracker) {
							await this.tracker.clearTracking();
						}
					}
					await this.trackInstalledSettings(parsedSettings);
				} catch {
					// Ignore tracking errors on fresh install
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
			// Re-format to ensure consistent 2-space indentation
			const formattedContent = this.formatJsonContent(transformedSourceContent);
			await writeFile(destFile, formattedContent, "utf-8");
			return;
		}

		// Read existing destination settings
		// For global installs, normalize $CLAUDE_PROJECT_DIR paths to $HOME before merge
		// This ensures proper deduplication when user previously had local install hooks
		let destSettings: SettingsJson | null;
		if (this.isGlobal) {
			destSettings = await this.readAndNormalizeGlobalSettings(destFile);
		} else {
			destSettings = await SettingsMerger.readSettingsFile(destFile);
		}
		if (!destSettings) {
			// Destination doesn't exist or is invalid, write formatted source
			await SettingsMerger.writeSettingsFile(destFile, sourceSettings);
			// Track what we just installed (fresh install)
			await this.trackInstalledSettings(sourceSettings);
			return;
		}

		// Load previously installed settings for respecting user deletions
		let installedSettings: InstalledSettings = { hooks: [], mcpServers: [] };
		if (this.tracker) {
			installedSettings = await this.tracker.loadInstalledSettings();
		}

		// Perform selective merge (atomic write ensures data integrity without backup files)
		const mergeResult = SettingsMerger.merge(sourceSettings, destSettings, {
			installedSettings,
			sourceKit: this.installingKit,
		});

		// Log merge results (verbose shows details, normal just shows summary)
		logger.verbose("Settings merge details", {
			hooksAdded: mergeResult.hooksAdded,
			hooksPreserved: mergeResult.hooksPreserved,
			hooksSkipped: mergeResult.hooksSkipped,
			mcpServersPreserved: mergeResult.mcpServersPreserved,
			mcpServersSkipped: mergeResult.mcpServersSkipped,
			duplicatesSkipped: mergeResult.conflictsDetected.length,
		});
		if (mergeResult.hooksSkipped > 0 || mergeResult.mcpServersSkipped > 0) {
			logger.info(
				`Preserved user preferences: ${mergeResult.hooksSkipped} hooks, ${mergeResult.mcpServersSkipped} MCP servers skipped`,
			);
		}
		if (mergeResult.conflictsDetected.length > 0) {
			logger.warning(`Duplicate hooks skipped: ${mergeResult.conflictsDetected.length}`);
		}

		// Update tracking with newly installed items
		if (
			this.tracker &&
			(mergeResult.newlyInstalledHooks.length > 0 || mergeResult.newlyInstalledServers.length > 0)
		) {
			for (const hook of mergeResult.newlyInstalledHooks) {
				this.tracker.trackHook(hook, installedSettings);
			}
			for (const server of mergeResult.newlyInstalledServers) {
				this.tracker.trackMcpServer(server, installedSettings);
			}
			await this.tracker.saveInstalledSettings(installedSettings);
		}

		// Write merged settings
		await SettingsMerger.writeSettingsFile(destFile, mergeResult.merged);
		logger.success("Merged settings.json (user customizations preserved)");
	}

	/**
	 * Track settings from a fresh install
	 */
	private async trackInstalledSettings(settings: SettingsJson): Promise<void> {
		if (!this.tracker) return;

		const installedSettings: InstalledSettings = { hooks: [], mcpServers: [] };

		// Track all hooks
		if (settings.hooks) {
			for (const entries of Object.values(settings.hooks)) {
				for (const entry of entries) {
					if ("command" in entry && entry.command) {
						this.tracker.trackHook(entry.command, installedSettings);
					}
					if ("hooks" in entry && entry.hooks) {
						for (const hook of entry.hooks) {
							if (hook.command) {
								this.tracker.trackHook(hook.command, installedSettings);
							}
						}
					}
				}
			}
		}

		// Track all MCP servers
		if (settings.mcp?.servers) {
			for (const serverName of Object.keys(settings.mcp.servers)) {
				this.tracker.trackMcpServer(serverName, installedSettings);
			}
		}

		await this.tracker.saveInstalledSettings(installedSettings);
		logger.debug("Tracked installed settings for fresh install");
	}

	/**
	 * Format JSON content with consistent 2-space indentation
	 * If parsing fails, returns original content unchanged
	 */
	private formatJsonContent(content: string): string {
		try {
			const parsed = JSON.parse(content);
			return JSON.stringify(parsed, null, 2);
		} catch {
			// If JSON parsing fails, return original content
			return content;
		}
	}

	/**
	 * Read settings file and normalize $CLAUDE_PROJECT_DIR paths to $HOME for global installs.
	 * This ensures deduplication works correctly when merging into global settings.
	 */
	private async readAndNormalizeGlobalSettings(destFile: string): Promise<SettingsJson | null> {
		try {
			const content = await readFile(destFile, "utf-8");
			if (!content.trim()) return null;

			// Replace $CLAUDE_PROJECT_DIR with $HOME (Unix) or %USERPROFILE% (Windows)
			const homeVar = isWindows() ? "%USERPROFILE%" : "$HOME";
			let normalized = content;

			// Unix: $CLAUDE_PROJECT_DIR → $HOME (handle both quoted and unquoted)
			normalized = normalized.replace(/"\$CLAUDE_PROJECT_DIR"/g, `"${homeVar}"`);
			normalized = normalized.replace(/\$CLAUDE_PROJECT_DIR/g, homeVar);

			// Windows: %CLAUDE_PROJECT_DIR% → %USERPROFILE%
			normalized = normalized.replace(/"%CLAUDE_PROJECT_DIR%"/g, `"${homeVar}"`);
			normalized = normalized.replace(/%CLAUDE_PROJECT_DIR%/g, homeVar);

			if (normalized !== content) {
				logger.debug("Normalized $CLAUDE_PROJECT_DIR paths to $HOME in existing global settings");
			}

			return JSON.parse(normalized) as SettingsJson;
		} catch {
			return null;
		}
	}

	/**
	 * Transform relative .claude/ paths to use a prefix variable
	 *
	 * @param content - The file content to transform
	 * @param prefix - The environment variable prefix (e.g., '"$HOME"', '"%USERPROFILE%"')
	 * @returns Transformed content with paths prefixed
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
		const jsonSafePrefix = prefix.includes('"') ? prefix.replace(/"/g, '\\"') : prefix;

		// Extract raw env var (without quotes) for path value replacements
		const rawPrefix = prefix.replace(/"/g, "");

		// Pattern 1: "node .claude/" or "node ./.claude/" - common hook command pattern
		transformed = transformed.replace(
			/(node\s+)(?:\.\/)?\.claude\//g,
			`$1${jsonSafePrefix}/.claude/`,
		);

		// Pattern 2: Already has $CLAUDE_PROJECT_DIR - replace with appropriate prefix
		if (rawPrefix.includes("HOME") || rawPrefix.includes("USERPROFILE")) {
			// Global mode: $CLAUDE_PROJECT_DIR → $HOME or %USERPROFILE%
			transformed = transformed.replace(/\$CLAUDE_PROJECT_DIR/g, rawPrefix);
			transformed = transformed.replace(/%CLAUDE_PROJECT_DIR%/g, rawPrefix);
		}

		return transformed;
	}
}
