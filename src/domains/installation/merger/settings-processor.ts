import { execSync } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { InstalledSettingsTracker } from "@/domains/config/installed-settings-tracker.js";
import { type SettingsJson, SettingsMerger } from "@/domains/config/settings-merger.js";
import { normalizeCommand, repairClaudeNodeCommandPath } from "@/shared/command-normalizer.js";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import type { InstalledSettings } from "@/types";
import { copy, pathExists, readFile, writeFile } from "fs-extra";
import semver from "semver";

/**
 * SettingsProcessor handles settings.json processing with selective merge and path transformation
 */
export class SettingsProcessor {
	/** Minimum Claude Code version that supports TaskCompleted/TeammateIdle hooks.
	 * Earlier versions throw "Invalid key in record" errors. See claudekit-engineer#464 */
	private static readonly MIN_TEAM_HOOKS_VERSION = "2.1.33";

	private isGlobal = false;
	private forceOverwriteSettings = false;
	private projectDir = "";
	private kitName = "engineer";
	private tracker: InstalledSettingsTracker | null = null;
	private installingKit: string | undefined;
	private cachedVersion: string | null | undefined = undefined;
	private deletionPatterns: string[] = [];

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
	 * Set deletion patterns from metadata.json for pruning stale hooks.
	 * Hook commands referencing files matching these patterns will be removed
	 * from settings.json during merge, even without tracking history.
	 */
	setDeletions(deletions: string[]): void {
		this.deletionPatterns = deletions;
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
	 * - Global mode: .claude/ → "$HOME/.claude/" (all shells — $HOME works in PowerShell, cmd, Git Bash, Unix)
	 * - Local mode: .claude/ → "$CLAUDE_PROJECT_DIR"/.claude/ (keep .claude outside the quoted var)
	 *   so Claude Code's Windows expansion does not collapse the separator into `project.claude`
	 */
	async processSettingsJson(sourceFile: string, destFile: string): Promise<void> {
		try {
			// Read the source settings.json content
			const sourceContent = await readFile(sourceFile, "utf-8");

			// Transform paths in source content first
			let transformedSource = sourceContent;
			if (this.isGlobal) {
				const globalRoot = this.getCanonicalGlobalCommandRoot();
				transformedSource = this.transformClaudePaths(sourceContent, globalRoot);
				if (transformedSource !== sourceContent) {
					logger.debug(
						`Transformed .claude/ paths to ${globalRoot} in settings.json for global installation`,
					);
				}
			} else {
				transformedSource = this.transformClaudePaths(sourceContent, "$CLAUDE_PROJECT_DIR");
				if (transformedSource !== sourceContent) {
					logger.debug(
						'Transformed .claude/ paths to "$CLAUDE_PROJECT_DIR"/.claude/ in settings.json for local installation',
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
				try {
					const parsedSettings = JSON.parse(transformedSource) as SettingsJson;

					// Fix broken hook path formats before writing
					this.fixHookCommandPaths(parsedSettings);

					await SettingsMerger.writeSettingsFile(destFile, parsedSettings);

					// Tracking is best-effort — failures must not corrupt the already-written file
					try {
						if (this.forceOverwriteSettings && destExists) {
							logger.debug("Force overwrite enabled, replaced settings.json completely");
							if (this.tracker) {
								await this.tracker.clearTracking();
							}
						}
						await this.trackInstalledSettings(parsedSettings);
					} catch {
						logger.debug("Settings tracking failed (non-fatal)");
					}
				} catch {
					// Fallback: write formatted content directly
					const formattedContent = this.formatJsonContent(transformedSource);
					await writeFile(destFile, formattedContent, "utf-8");
				}

				// Inject team hooks if supported
				await this.injectTeamHooksIfSupported(destFile);
			}

			await this.repairSiblingSettingsLocal(destFile);
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

		// Migrate deprecated matchers before merge so deduplication works correctly
		this.migrateDeprecatedMatchers(destSettings, sourceSettings);

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

		// Fix broken hook path formats (tilde, variable-only quoting, unquoted)
		const pathsFixed = this.fixHookCommandPaths(mergeResult.merged);
		if (pathsFixed) {
			logger.info("Fixed hook command paths to canonical quoted format");
		}

		// Prune hooks referencing files listed in metadata.json deletions
		const hooksPruned = this.pruneDeletedHooks(mergeResult.merged);
		if (hooksPruned > 0) {
			logger.info(`Pruned ${hooksPruned} stale hook(s) referencing deleted files`);
		}

		// Write merged settings
		await SettingsMerger.writeSettingsFile(destFile, mergeResult.merged);
		logger.success("Merged settings.json (user customizations preserved)");

		// Inject team hooks if supported
		await this.injectTeamHooksIfSupported(destFile, mergeResult.merged);
	}

	/**
	 * Migrate deprecated hook matchers in destination settings to match source.
	 * Fixes the merge gap where matcher change (e.g., "*" -> "Bash|Edit|...") causes
	 * the merger to skip updates because command dedup sees the hook as already present
	 * under the old matcher, while the new matcher is treated as a different entry.
	 *
	 * Runs before merge so deduplication sees correct matchers.
	 */
	private migrateDeprecatedMatchers(
		destSettings: SettingsJson,
		sourceSettings: SettingsJson,
	): void {
		if (!destSettings.hooks || !sourceSettings.hooks) return;

		for (const [eventName, sourceEntries] of Object.entries(sourceSettings.hooks)) {
			const destEntries = destSettings.hooks[eventName];
			if (!destEntries) continue;

			for (const sourceEntry of sourceEntries) {
				if (!("matcher" in sourceEntry) || !sourceEntry.matcher) continue;
				if (!("hooks" in sourceEntry) || !sourceEntry.hooks) continue;

				const sourceCommands = new Set(
					sourceEntry.hooks.map((h) => normalizeCommand(h.command)).filter((c) => c.length > 0),
				);
				if (sourceCommands.size === 0) continue;

				// Find dest entries with DIFFERENT matcher but SAME commands
				for (const destEntry of destEntries) {
					if (!("matcher" in destEntry)) continue;
					if (destEntry.matcher === sourceEntry.matcher) continue; // Already matching
					if (!("hooks" in destEntry) || !destEntry.hooks) continue;

					const destCommands = destEntry.hooks
						.map((h) => normalizeCommand(h.command))
						.filter((c) => c.length > 0);

					// Check if any dest commands overlap with source commands
					const hasOverlap = destCommands.some((cmd) => sourceCommands.has(cmd));
					if (!hasOverlap) continue;

					const oldMatcher = destEntry.matcher;
					// Migrate: update matcher and merge timeout from source
					destEntry.matcher = sourceEntry.matcher;

					// Also sync timeout from source hooks to dest hooks
					for (const destHook of destEntry.hooks) {
						const normalizedDest = normalizeCommand(destHook.command);
						const matchingSource = sourceEntry.hooks.find(
							(sh) => normalizeCommand(sh.command) === normalizedDest,
						);
						if (matchingSource?.timeout !== undefined) {
							destHook.timeout = matchingSource.timeout;
						}
					}

					logger.info(`Migrated ${eventName} matcher: "${oldMatcher}" -> "${sourceEntry.matcher}"`);
				}
			}
		}
	}

	/**
	 * Prune hooks whose commands reference files matching metadata.json deletions.
	 * Handles all path formats: $HOME, $CLAUDE_PROJECT_DIR, %USERPROFILE%, relative .claude/.
	 * Removes empty event arrays after pruning.
	 * @returns Number of hooks pruned
	 */
	private pruneDeletedHooks(settings: SettingsJson): number {
		if (this.deletionPatterns.length === 0 || !settings.hooks) return 0;

		// Build set of hook-relevant deletion paths (only hooks/* entries)
		const hookDeletions = new Set(this.deletionPatterns.filter((p) => p.startsWith("hooks/")));
		if (hookDeletions.size === 0) return 0;

		let pruned = 0;
		const eventKeysToDelete: string[] = [];

		for (const [eventName, entries] of Object.entries(settings.hooks)) {
			const filteredEntries: (typeof entries)[number][] = [];

			for (const entry of entries) {
				if ("hooks" in entry && entry.hooks) {
					// HookConfig with hooks array — filter individual hooks
					const remainingHooks = entry.hooks.filter((h) => {
						const relativePath = this.extractHookRelativePath(h.command);
						if (relativePath && hookDeletions.has(relativePath)) {
							logger.info(`Pruned stale hook: ${h.command.slice(0, 80)}`);
							pruned++;
							return false;
						}
						return true;
					});
					if (remainingHooks.length > 0) {
						filteredEntries.push({ ...entry, hooks: remainingHooks });
					}
				} else if ("command" in entry) {
					// Single HookEntry
					const relativePath = this.extractHookRelativePath(entry.command);
					if (relativePath && hookDeletions.has(relativePath)) {
						logger.info(`Pruned stale hook: ${entry.command.slice(0, 80)}`);
						pruned++;
					} else {
						filteredEntries.push(entry);
					}
				} else {
					filteredEntries.push(entry);
				}
			}

			if (filteredEntries.length > 0) {
				settings.hooks[eventName] = filteredEntries;
			} else {
				eventKeysToDelete.push(eventName);
			}
		}

		// Remove empty event arrays
		for (const key of eventKeysToDelete) {
			delete settings.hooks[key];
		}

		return pruned;
	}

	/**
	 * Extract the relative .claude/ path from a hook command string.
	 * Handles: node "$HOME/.claude/hooks/foo.cjs", node "$CLAUDE_PROJECT_DIR/.claude/hooks/foo.cjs",
	 * node .claude/hooks/foo.cjs, node "%USERPROFILE%/.claude/hooks/foo.cjs"
	 * @returns Relative path like "hooks/foo.cjs" or null if not a .claude/ hook command
	 */
	private extractHookRelativePath(command: string): string | null {
		if (!command) return null;
		// Match .claude/ followed by valid filename chars (word chars, dots, hyphens, forward/back slashes)
		// Character class: \w=alphanumeric+underscore, . = literal dot, - = hyphen, /\\ = slashes
		// Stop at quote, space, or end of string
		const match = command.match(/\.claude[/\\]([\w.\-/\\]+)/);
		return match ? match[1].replace(/\\/g, "/") : null;
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
	 * NOTE: Mutations are in-memory only — callers must persist the result via writeSettingsFile.
	 */
	private async readAndNormalizeGlobalSettings(destFile: string): Promise<SettingsJson | null> {
		try {
			const content = await readFile(destFile, "utf-8");
			if (!content.trim()) return null;
			const parsedSettings = JSON.parse(content) as SettingsJson;
			this.fixHookCommandPaths(parsedSettings);
			return parsedSettings;
		} catch {
			return null;
		}
	}

	/**
	 * Transform relative .claude/ paths to use a prefix variable.
	 *
	 * Global installs keep the full path inside quotes so `$HOME/.claude/...` survives spaces.
	 * Local installs must keep `.claude/...` outside the quoted `$CLAUDE_PROJECT_DIR` token.
	 * Embedding `/.claude/...` inside the quoted variable triggers a Windows expansion bug where
	 * Claude Code resolves `project/.claude/...` as `project.claude/...`.
	 *
	 * @param content - The file content to transform (raw JSON)
	 * @param root - The path root (e.g., "$HOME", "$CLAUDE_PROJECT_DIR", "/custom/claude")
	 * @returns Transformed content with the appropriate quoting strategy per scope
	 */
	private transformClaudePaths(content: string, root: string): string {
		// Security: Validate that .claude/ paths don't contain shell injection attempts
		// Matches dangerous chars after .claude/ but before whitespace or quote
		if (/\.claude\/[^\s"']*[;`$&|><]/.test(content)) {
			logger.warning("Potentially unsafe characters detected in .claude/ paths");
			throw new Error("Settings file contains potentially unsafe path characters");
		}

		let transformed = content;

		// Pattern 1: node .claude/... or node ./.claude/... in settings JSON.
		// Global: node \"$HOME/.claude/hooks/foo.cjs\"
		// Local:  node \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/foo.cjs
		// NOTE: formatCommandPath returns plain output with literal " chars.
		// The .replace(/"/g, '\\"') is needed here because this regex operates on raw JSON text,
		// so quotes must be escaped. fixSingleCommandPath does NOT apply this escape because it
		// works on parsed command strings (post-JSON-decode).
		transformed = transformed.replace(
			/(node\s+)(?:\.\/)?(\.claude\/[^\s"\\]+)([^"\\]*)/g,
			(_match, nodePrefix: string, relativePath: string, suffix: string) => {
				return this.formatCommandPath(nodePrefix, root, relativePath, suffix).replace(/"/g, '\\"');
			},
		);

		// Pattern 2: Already has $CLAUDE_PROJECT_DIR - replace with appropriate prefix
		if (this.isGlobal) {
			transformed = transformed.replace(/"\$CLAUDE_PROJECT_DIR"/g, `"${root}"`);
			transformed = transformed.replace(/\$CLAUDE_PROJECT_DIR/g, root);
			transformed = transformed.replace(/"%CLAUDE_PROJECT_DIR%"/g, `"${root}"`);
			transformed = transformed.replace(/%CLAUDE_PROJECT_DIR%/g, root);
		}

		return transformed;
	}

	/**
	 * Fix hook command path formats in settings after merge.
	 * Repairs all known broken formats to the canonical scope-aware form.
	 *
	 * Fixes:
	 * - Tilde: node ~/.claude/... → node "$HOME/.claude/..."
	 * - Global variable-only quoting: node "$HOME"/.claude/... → node "$HOME/.claude/..."
	 * - Local embedded quoting: node "$CLAUDE_PROJECT_DIR/.claude/..." → node "$CLAUDE_PROJECT_DIR"/.claude/...
	 * - Unquoted: node $HOME/.claude/... → node "$HOME/.claude/..."
	 * - Windows %USERPROFILE% → normalized to $HOME (universal across all shells)
	 *
	 * This runs AFTER merge so it catches both source (new) and destination (existing) hooks.
	 */
	private fixHookCommandPaths(settings: SettingsJson): boolean {
		let fixed = false;

		// Fix hooks
		if (settings.hooks) {
			for (const entries of Object.values(settings.hooks)) {
				for (const entry of entries) {
					if ("command" in entry && entry.command) {
						const result = this.fixSingleCommandPath(entry.command);
						if (result !== entry.command) {
							entry.command = result;
							fixed = true;
						}
					}
					if ("hooks" in entry && entry.hooks) {
						for (const hook of entry.hooks) {
							if (hook.command) {
								const result = this.fixSingleCommandPath(hook.command);
								if (result !== hook.command) {
									hook.command = result;
									fixed = true;
								}
							}
						}
					}
				}
			}
		}

		// Fix statusLine command if present
		const statusLine = settings.statusLine as { command?: string } | undefined;
		if (statusLine?.command) {
			const result = this.fixSingleCommandPath(statusLine.command);
			if (result !== statusLine.command) {
				statusLine.command = result;
				fixed = true;
			}
		}

		return fixed;
	}

	/**
	 * Fix a single hook command path to canonical scope-aware quoting.
	 * Only processes paths containing .claude/ — leaves other commands untouched.
	 */
	private fixSingleCommandPath(cmd: string): string {
		return repairClaudeNodeCommandPath(cmd, this.getClaudeCommandRoot()).command;
	}

	private formatCommandPath(
		nodePrefix: string,
		capturedVar: string,
		relativePath: string,
		suffix = "",
	): string {
		const canonicalRoot = this.canonicalizePathRoot(capturedVar);
		const normalizedRelativePath = this.normalizeRelativePath(canonicalRoot, relativePath);
		return canonicalRoot === "$CLAUDE_PROJECT_DIR"
			? `${nodePrefix}"${canonicalRoot}"/${normalizedRelativePath}${suffix}`
			: `${nodePrefix}"${canonicalRoot}/${normalizedRelativePath}"${suffix}`;
	}

	/**
	 * Map platform-specific path variables to their canonical cross-platform form.
	 * - %USERPROFILE% → $HOME (universal across all shells)
	 * - %CLAUDE_PROJECT_DIR% → $CLAUDE_PROJECT_DIR (CC expands both, prefer Unix-style)
	 */
	private canonicalizePathRoot(capturedVar: string): string {
		switch (capturedVar) {
			case "%USERPROFILE%":
			case "$HOME":
				return this.isGlobal ? this.getCanonicalGlobalCommandRoot() : "$HOME";
			case "%CLAUDE_PROJECT_DIR%":
			case "$CLAUDE_PROJECT_DIR":
				return this.isGlobal ? this.getCanonicalGlobalCommandRoot() : "$CLAUDE_PROJECT_DIR";
			default:
				return capturedVar.replace(/\\/g, "/").replace(/\/+$/, "");
		}
	}

	private normalizeRelativePath(root: string, relativePath: string): string {
		const normalizedRelativePath = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");

		if (root !== "$CLAUDE_PROJECT_DIR" && this.usesCustomGlobalInstallPath()) {
			return normalizedRelativePath.replace(/^\.claude\//, "");
		}

		return normalizedRelativePath;
	}

	private getCanonicalGlobalCommandRoot(): string {
		if (this.usesCustomGlobalInstallPath()) {
			return PathResolver.getGlobalKitDir().replace(/\\/g, "/").replace(/\/+$/, "");
		}

		return "$HOME";
	}

	private usesCustomGlobalInstallPath(): boolean {
		if (!this.isGlobal || !this.projectDir) {
			if (this.isGlobal && !this.projectDir) {
				logger.debug(
					"usesCustomGlobalInstallPath: global mode but projectDir not set — defaulting to $HOME",
				);
			}
			return false;
		}

		const configuredGlobalDir = PathResolver.getGlobalKitDir()
			.replace(/\\/g, "/")
			.replace(/\/+$/, "");
		const defaultGlobalDir = join(homedir(), ".claude").replace(/\\/g, "/");
		return configuredGlobalDir !== defaultGlobalDir;
	}

	private getClaudeCommandRoot(): string {
		return this.isGlobal ? this.getCanonicalGlobalCommandRoot() : "$CLAUDE_PROJECT_DIR";
	}

	private async repairSettingsFile(filePath: string): Promise<boolean> {
		const settings = await SettingsMerger.readSettingsFile(filePath);
		if (!settings) {
			return false;
		}

		const pathsFixed = this.fixHookCommandPaths(settings);
		if (!pathsFixed) {
			return false;
		}

		await SettingsMerger.writeSettingsFile(filePath, settings);
		return true;
	}

	private async repairSiblingSettingsLocal(destFile: string): Promise<void> {
		const settingsLocalPath = join(dirname(destFile), "settings.local.json");
		if (settingsLocalPath === destFile || !(await pathExists(settingsLocalPath))) {
			return;
		}

		if (await this.repairSettingsFile(settingsLocalPath)) {
			logger.info(`Repaired stale .claude command paths in ${settingsLocalPath}`);
		}
	}

	/**
	 * Detect Claude Code version by running `claude --version`
	 * @returns Version string (e.g., "2.1.34") or null on error
	 */
	private detectClaudeCodeVersion(): string | null {
		if (this.cachedVersion !== undefined) return this.cachedVersion;
		try {
			const output = execSync("claude --version", {
				encoding: "utf-8",
				timeout: 5000,
				stdio: ["ignore", "pipe", "ignore"],
			});
			// Flexible regex: handles "2.1.33", "Claude Code v2.1.33", "2.1.33-beta.1"
			const match = output.match(/(\d+\.\d+\.\d+)/);
			this.cachedVersion = match ? match[1] : null;
		} catch {
			this.cachedVersion = null;
		}
		return this.cachedVersion;
	}

	/**
	 * Semver comparison using the semver package
	 * Coerces version to base (e.g., 2.1.33-beta.1 → 2.1.33) before comparing
	 * @returns true if version >= minimum
	 */
	private isVersionAtLeast(version: string, minimum: string): boolean {
		const coerced = semver.coerce(version);
		if (!coerced) return false;
		return semver.gte(coerced, minimum);
	}

	/**
	 * Inject team hooks if Claude Code >= 2.1.33 is detected
	 * Adds TaskCompleted and TeammateIdle hooks if not already present
	 * @param destFile - Path to settings.json
	 * @param existingSettings - Optional parsed settings to avoid re-reading from disk
	 */
	private async injectTeamHooksIfSupported(
		destFile: string,
		existingSettings?: SettingsJson,
	): Promise<void> {
		const version = this.detectClaudeCodeVersion();
		if (!version) {
			logger.debug("Claude Code version not detected, skipping team hooks injection");
			return;
		}

		if (!this.isVersionAtLeast(version, SettingsProcessor.MIN_TEAM_HOOKS_VERSION)) {
			logger.debug(
				`Claude Code ${version} does not support team hooks (requires >= 2.1.33), skipping injection`,
			);
			return;
		}

		logger.debug(`Claude Code ${version} detected, checking team hooks`);

		// Use provided settings or read from disk
		const settings = existingSettings ?? (await SettingsMerger.readSettingsFile(destFile));
		if (!settings) {
			logger.warning("Failed to read settings file for team hooks injection");
			return;
		}

		// Initialize hooks if missing
		if (!settings.hooks) {
			settings.hooks = {};
		}

		let injected = false;
		const installedSettings = this.tracker
			? await this.tracker.loadInstalledSettings()
			: { hooks: [], mcpServers: [] };

		// Inject hooks only if not present AND not previously removed by user
		const teamHooks = [
			{ event: "TaskCompleted", handler: "task-completed-handler.cjs" },
			{ event: "TeammateIdle", handler: "teammate-idle-handler.cjs" },
		] as const;

		for (const { event, handler } of teamHooks) {
			const hookCommand = this.formatCommandPath(
				"node ",
				this.isGlobal ? this.getCanonicalGlobalCommandRoot() : "$CLAUDE_PROJECT_DIR",
				`.claude/hooks/${handler}`,
			);
			const eventHooks = settings.hooks[event];

			if (eventHooks && eventHooks.length > 0) continue; // Already present

			// Respect user deletion: if CK previously installed this hook but user removed it, skip
			if (this.tracker?.wasHookInstalled(hookCommand, installedSettings)) {
				logger.debug(`Skipping ${event} hook injection (previously removed by user)`);
				continue;
			}

			settings.hooks[event] = [{ hooks: [{ type: "command", command: hookCommand }] }];
			logger.info(`Injected ${event} hook`);
			injected = true;

			if (this.tracker) {
				this.tracker.trackHook(hookCommand, installedSettings);
			}
		}

		// Write back if hooks were injected
		if (injected) {
			await SettingsMerger.writeSettingsFile(destFile, settings);
			// Save tracking
			if (this.tracker) {
				await this.tracker.saveInstalledSettings(installedSettings);
			}
			logger.success("Team hooks injected successfully");
		} else {
			logger.debug("Team hooks already present, no injection needed");
		}
	}
}
