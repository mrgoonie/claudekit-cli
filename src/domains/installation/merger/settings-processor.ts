import { execSync } from "node:child_process";
import { InstalledSettingsTracker } from "@/domains/config/installed-settings-tracker.js";
import { type SettingsJson, SettingsMerger } from "@/domains/config/settings-merger.js";
import { normalizeCommand } from "@/shared/command-normalizer.js";
import { logger } from "@/shared/logger.js";
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
	 * - Global mode: .claude/ → "$HOME/.claude/" (all shells — $HOME works in PowerShell, cmd, Git Bash, Unix)
	 * - Local mode: .claude/ → "$CLAUDE_PROJECT_DIR/.claude/" (CC expands this internally on all platforms)
	 */
	async processSettingsJson(sourceFile: string, destFile: string): Promise<void> {
		try {
			// Read the source settings.json content
			const sourceContent = await readFile(sourceFile, "utf-8");

			// Transform paths in source content first
			let transformedSource = sourceContent;
			if (this.isGlobal) {
				const homeVar = '"$HOME"';
				transformedSource = this.transformClaudePaths(sourceContent, homeVar);
				if (transformedSource !== sourceContent) {
					logger.debug(
						`Transformed .claude/ paths to ${homeVar}/.claude/ in settings.json for global installation`,
					);
				}
			} else {
				const projectDirVar = '"$CLAUDE_PROJECT_DIR"';
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

			// Replace $CLAUDE_PROJECT_DIR (and Windows variants) with $HOME (universal)
			const homeVar = "$HOME";
			let normalized = content;

			// Unix: $CLAUDE_PROJECT_DIR → $HOME (handle both quoted and unquoted)
			normalized = normalized.replace(/"\$CLAUDE_PROJECT_DIR"/g, `"${homeVar}"`);
			normalized = normalized.replace(/\$CLAUDE_PROJECT_DIR/g, homeVar);

			// Windows: %CLAUDE_PROJECT_DIR% → $HOME
			normalized = normalized.replace(/"%CLAUDE_PROJECT_DIR%"/g, `"${homeVar}"`);
			normalized = normalized.replace(/%CLAUDE_PROJECT_DIR%/g, homeVar);

			// Windows: %USERPROFILE% → $HOME (migration for pre-existing files)
			normalized = normalized.replace(/"%USERPROFILE%"/g, `"${homeVar}"`);
			normalized = normalized.replace(/%USERPROFILE%/g, homeVar);

			if (normalized !== content) {
				logger.debug("Normalized $CLAUDE_PROJECT_DIR paths to $HOME in existing global settings");
			}

			return JSON.parse(normalized) as SettingsJson;
		} catch {
			return null;
		}
	}

	/**
	 * Transform relative .claude/ paths to use a prefix variable.
	 * Wraps the ENTIRE path argument in quotes to handle spaces in paths
	 * (e.g., C:\Users\Thieu Nguyen\).
	 *
	 * @param content - The file content to transform (raw JSON)
	 * @param prefix - The environment variable prefix (e.g., '"$HOME"', '"%USERPROFILE%"')
	 * @returns Transformed content with paths prefixed and fully quoted
	 */
	private transformClaudePaths(content: string, prefix: string): string {
		// Security: Validate that .claude/ paths don't contain shell injection attempts
		// Matches dangerous chars after .claude/ but before whitespace or quote
		if (/\.claude\/[^\s"']*[;`$&|><]/.test(content)) {
			logger.warning("Potentially unsafe characters detected in .claude/ paths");
			throw new Error("Settings file contains potentially unsafe path characters");
		}

		let transformed = content;

		// Extract raw env var (without quotes) for all replacements
		const rawPrefix = prefix.replace(/"/g, "");

		// Pattern 1: "node .claude/..." or "node ./.claude/..." - hook command pattern
		// Captures the full path (e.g., .claude/hooks/session-init.cjs) and wraps
		// the entire argument (variable + path) in JSON-escaped quotes.
		// Before: node .claude/hooks/session-init.cjs
		// After:  node \"$HOME/.claude/hooks/session-init.cjs\" (in JSON)
		// Parsed: node "$HOME/.claude/hooks/session-init.cjs"
		transformed = transformed.replace(
			/(node\s+)(?:\.\/)?(\.claude\/[^\s"\\]+)/g,
			`$1\\"${rawPrefix}/$2\\"`,
		);

		// Pattern 2: Already has $CLAUDE_PROJECT_DIR - replace with appropriate prefix
		if (rawPrefix.includes("HOME") || rawPrefix.includes("USERPROFILE")) {
			// Global mode: $CLAUDE_PROJECT_DIR → $HOME or %USERPROFILE%
			transformed = transformed.replace(/\$CLAUDE_PROJECT_DIR/g, rawPrefix);
			transformed = transformed.replace(/%CLAUDE_PROJECT_DIR%/g, rawPrefix);
		}

		return transformed;
	}

	/**
	 * Fix hook command path formats in settings after merge.
	 * Repairs all known broken formats to the canonical full-path-quoted form.
	 *
	 * Fixes:
	 * - Tilde: node ~/.claude/... → node "$HOME/.claude/..."
	 * - Variable-only quoting: node "$HOME"/.claude/... → node "$HOME/.claude/..."
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
	 * Fix a single hook command path to canonical full-path-quoted format.
	 * Only processes paths containing .claude/ — leaves other commands untouched.
	 */
	private fixSingleCommandPath(cmd: string): string {
		// Only fix node commands targeting .claude/ paths
		if (!cmd.includes(".claude/") && !cmd.includes(".claude\\")) return cmd;

		// Pattern: node "VAR"/.claude/... (variable-only quoting — the main bug)
		const varOnlyQuotingRe =
			/^(node\s+)"(\$HOME|\$CLAUDE_PROJECT_DIR|%USERPROFILE%|%CLAUDE_PROJECT_DIR%)"[/\\](.+)$/;
		const varOnlyMatch = cmd.match(varOnlyQuotingRe);
		if (varOnlyMatch) {
			const [, nodePrefix, capturedVar, restPath] = varOnlyMatch;
			const canonicalVar = this.canonicalizePathVar(capturedVar);
			return `${nodePrefix}"${canonicalVar}/${restPath.replace(/\\/g, "/")}"`;
		}

		// Pattern: node ~/.claude/... (tilde — doesn't expand on Windows)
		const tildeRe = /^(node\s+)~[/\\](.+)$/;
		const tildeMatch = cmd.match(tildeRe);
		if (tildeMatch) {
			const [, nodePrefix, restPath] = tildeMatch;
			return `${nodePrefix}"$HOME/${restPath.replace(/\\/g, "/")}"`;
		}

		// Pattern: node $HOME/.claude/... or node %USERPROFILE%/.claude/... (unquoted)
		const unquotedRe =
			/^(node\s+)(\$HOME|\$CLAUDE_PROJECT_DIR|%USERPROFILE%|%CLAUDE_PROJECT_DIR%)[/\\](.+)$/;
		const unquotedMatch = cmd.match(unquotedRe);
		if (unquotedMatch) {
			const [, nodePrefix, capturedVar, restPath] = unquotedMatch;
			const canonicalVar = this.canonicalizePathVar(capturedVar);
			return `${nodePrefix}"${canonicalVar}/${restPath.replace(/\\/g, "/")}"`;
		}

		return cmd;
	}

	/**
	 * Map platform-specific path variables to their canonical cross-platform form.
	 * - %USERPROFILE% → $HOME (universal across all shells)
	 * - %CLAUDE_PROJECT_DIR% → $CLAUDE_PROJECT_DIR (CC expands both, prefer Unix-style)
	 */
	private canonicalizePathVar(capturedVar: string): string {
		switch (capturedVar) {
			case "%USERPROFILE%":
				return "$HOME";
			case "%CLAUDE_PROJECT_DIR%":
				return "$CLAUDE_PROJECT_DIR";
			default:
				return capturedVar;
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

		// Determine path prefix (universal — $HOME works in PowerShell, cmd, Git Bash, Unix)
		const prefix = this.isGlobal ? "$HOME" : "$CLAUDE_PROJECT_DIR";

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
			const hookCommand = `node "${prefix}/.claude/hooks/${handler}"`;
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
