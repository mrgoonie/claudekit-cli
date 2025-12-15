import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { logger } from "@/shared/logger.js";
import { pathExists, readFile, rename, unlink, writeFile } from "fs-extra";

/**
 * Settings JSON structure types
 */
export interface HookEntry {
	type: string;
	command: string;
	matcher?: string;
	timeout?: number;
}

export interface HookConfig {
	matcher?: string;
	hooks?: HookEntry[];
}

export interface McpServerConfig {
	command?: string;
	args?: string[];
	env?: Record<string, string>;
	url?: string;
	[key: string]: unknown;
}

export interface SettingsJson {
	hooks?: Record<string, HookConfig[] | HookEntry[]>;
	mcp?: {
		servers?: Record<string, McpServerConfig>;
		[key: string]: unknown;
	};
	[key: string]: unknown;
}

export interface MergeResult {
	merged: SettingsJson;
	hooksAdded: number;
	hooksPreserved: number;
	mcpServersPreserved: number;
	conflictsDetected: string[];
}

/**
 * SettingsMerger - Handles selective deep merge of settings.json
 *
 * Merge strategy:
 * - hooks: Merge arrays, deduplicate by command string
 * - mcp.servers: Preserve user servers, add new CK servers
 * - Other keys: CK-managed keys replace, user-only keys preserved
 */
export class SettingsMerger {
	/**
	 * Deep merge ClaudeKit settings into existing user settings
	 *
	 * @param source - ClaudeKit template settings (new)
	 * @param destination - User's existing settings (current)
	 * @returns Merged settings with stats
	 */
	static merge(source: SettingsJson, destination: SettingsJson): MergeResult {
		const result: MergeResult = {
			merged: { ...destination },
			hooksAdded: 0,
			hooksPreserved: 0,
			mcpServersPreserved: 0,
			conflictsDetected: [],
		};

		// Merge hooks
		if (source.hooks) {
			result.merged.hooks = SettingsMerger.mergeHooks(
				source.hooks,
				destination.hooks || {},
				result,
			);
		}

		// Merge MCP configuration
		if (source.mcp) {
			result.merged.mcp = SettingsMerger.mergeMcp(source.mcp, destination.mcp || {}, result);
		}

		// Copy other CK-managed keys that don't exist in destination
		for (const key of Object.keys(source)) {
			if (key !== "hooks" && key !== "mcp" && !(key in destination)) {
				result.merged[key] = source[key];
			}
		}

		return result;
	}

	/**
	 * Merge hooks configurations
	 * User hooks are preserved, CK hooks are added (deduplicated by command)
	 */
	private static mergeHooks(
		sourceHooks: Record<string, HookConfig[] | HookEntry[]>,
		destHooks: Record<string, HookConfig[] | HookEntry[]>,
		result: MergeResult,
	): Record<string, HookConfig[] | HookEntry[]> {
		const merged: Record<string, HookConfig[] | HookEntry[]> = { ...destHooks };

		for (const [eventName, sourceEntries] of Object.entries(sourceHooks)) {
			const destEntries = destHooks[eventName] || [];
			merged[eventName] = SettingsMerger.mergeHookEntries(
				sourceEntries,
				destEntries,
				eventName,
				result,
			);
		}

		return merged;
	}

	/**
	 * Merge hook entries for a specific event
	 * Deduplicates by command string and merges hooks with matching matchers
	 *
	 * Execution order: User hooks execute FIRST, then ClaudeKit hooks.
	 * This is intentional - user customizations take priority and can
	 * modify behavior before CK hooks run (e.g., environment setup).
	 *
	 * Matcher-aware merging: When source and dest have entries with the same
	 * matcher value, merge their hooks arrays instead of creating duplicates.
	 *
	 * Partial duplicate handling: If a CK entry contains both duplicate
	 * and unique commands, only unique commands are added to existing matchers.
	 */
	private static mergeHookEntries(
		sourceEntries: HookConfig[] | HookEntry[],
		destEntries: HookConfig[] | HookEntry[],
		eventName: string,
		result: MergeResult,
	): HookConfig[] | HookEntry[] {
		// Track preserved user hook entries only if destination has hooks for this event
		if (destEntries.length > 0) {
			result.hooksPreserved += destEntries.length;
		}

		// Deep copy destination entries to avoid mutating original
		const merged: (HookConfig | HookEntry)[] = destEntries.map((entry) =>
			SettingsMerger.deepCopyEntry(entry),
		);

		// Build index of existing matchers for efficient lookup
		const matcherIndex = new Map<string, number>();
		for (let i = 0; i < merged.length; i++) {
			const entry = merged[i];
			if ("matcher" in entry && entry.matcher) {
				matcherIndex.set(entry.matcher, i);
			}
		}

		// Extract all existing commands from destination for deduplication
		const existingCommands = new Set<string>();
		SettingsMerger.extractCommands(destEntries, existingCommands);

		// Process each source entry
		for (const entry of sourceEntries) {
			const sourceMatcher = "matcher" in entry ? entry.matcher : undefined;
			const commands = SettingsMerger.getEntryCommands(entry);

			// Check if a matcher entry with same value already exists
			if (sourceMatcher && matcherIndex.has(sourceMatcher)) {
				// Merge hooks into existing matcher entry
				const existingIdx = matcherIndex.get(sourceMatcher);
				if (existingIdx === undefined) continue;
				const existingEntry = merged[existingIdx] as HookConfig;

				// Get new commands not already in existing entry
				const newCommands = commands.filter((cmd) => !existingCommands.has(cmd));
				const duplicateCommands = commands.filter((cmd) => existingCommands.has(cmd));

				// Log duplicates
				if (duplicateCommands.length > 0) {
					const summary =
						duplicateCommands.length === 1
							? `"${SettingsMerger.truncateCommand(duplicateCommands[0])}"`
							: `${duplicateCommands.length} commands`;
					result.conflictsDetected.push(`${eventName}: duplicate ${summary}`);
				}

				// Add unique hooks to existing matcher
				if (newCommands.length > 0 && "hooks" in entry && entry.hooks) {
					if (!existingEntry.hooks) {
						existingEntry.hooks = [];
					}
					for (const hook of entry.hooks) {
						if (hook.command && !existingCommands.has(hook.command)) {
							existingEntry.hooks.push(hook);
							existingCommands.add(hook.command);
						}
					}
					result.hooksAdded++;
				}
			} else {
				// No matching matcher - check for full command duplication
				const isFullyDuplicated =
					commands.length > 0 && commands.every((cmd) => existingCommands.has(cmd));

				// Track duplicate commands for logging (partial or full)
				const duplicateCommands = commands.filter((cmd) => existingCommands.has(cmd));
				if (duplicateCommands.length > 0) {
					const summary =
						duplicateCommands.length === 1
							? `"${SettingsMerger.truncateCommand(duplicateCommands[0])}"`
							: `${duplicateCommands.length} commands`;
					result.conflictsDetected.push(`${eventName}: duplicate ${summary}`);
				}

				// Add entry if not fully duplicated
				if (!isFullyDuplicated) {
					merged.push(entry);
					result.hooksAdded++;
					// Register matcher if present
					if (sourceMatcher) {
						matcherIndex.set(sourceMatcher, merged.length - 1);
					}
					// Register new commands
					for (const cmd of commands) {
						existingCommands.add(cmd);
					}
				}
			}
		}

		return merged;
	}

	/**
	 * Deep copy a hook entry to avoid mutating originals
	 */
	private static deepCopyEntry(entry: HookConfig | HookEntry): HookConfig | HookEntry {
		if ("hooks" in entry) {
			return {
				...entry,
				hooks: entry.hooks ? [...entry.hooks.map((h) => ({ ...h }))] : undefined,
			};
		}
		return { ...entry };
	}

	/**
	 * Extract all command strings from hook entries
	 */
	private static extractCommands(entries: (HookConfig | HookEntry)[], commands: Set<string>): void {
		for (const entry of entries) {
			if ("command" in entry && entry.command) {
				commands.add(entry.command);
			}
			if ("hooks" in entry && entry.hooks) {
				for (const hook of entry.hooks) {
					if (hook.command) {
						commands.add(hook.command);
					}
				}
			}
		}
	}

	/**
	 * Get all commands from a single entry
	 */
	private static getEntryCommands(entry: HookConfig | HookEntry): string[] {
		const commands: string[] = [];
		if ("command" in entry && entry.command) {
			commands.push(entry.command);
		}
		if ("hooks" in entry && entry.hooks) {
			for (const hook of entry.hooks) {
				if (hook.command) {
					commands.push(hook.command);
				}
			}
		}
		return commands;
	}

	/**
	 * Truncate command string for display
	 */
	private static truncateCommand(cmd: string, maxLen = 50): string {
		if (cmd.length <= maxLen) return cmd;
		return `${cmd.slice(0, maxLen - 3)}...`;
	}

	/**
	 * Merge MCP configurations
	 * User servers are preserved, new CK servers are added
	 */
	private static mergeMcp(
		sourceMcp: SettingsJson["mcp"],
		destMcp: SettingsJson["mcp"],
		result: MergeResult,
	): SettingsJson["mcp"] {
		if (!sourceMcp) return destMcp;
		if (!destMcp) return sourceMcp;

		const merged: SettingsJson["mcp"] = { ...destMcp };

		// Merge servers
		if (sourceMcp.servers) {
			const destServers = destMcp.servers || {};
			merged.servers = { ...destServers };

			for (const [serverName, serverConfig] of Object.entries(sourceMcp.servers)) {
				if (serverName in destServers) {
					// User server preserved
					result.mcpServersPreserved++;
					logger.debug(`Preserved user MCP server: ${serverName}`);
				} else {
					// Add new CK server
					merged.servers[serverName] = serverConfig;
					logger.debug(`Added ClaudeKit MCP server: ${serverName}`);
				}
			}
		}

		// Copy other MCP keys that don't exist
		for (const key of Object.keys(sourceMcp)) {
			if (key !== "servers" && !(key in merged)) {
				merged[key] = sourceMcp[key];
			}
		}

		return merged;
	}

	/**
	 * Read and parse settings.json file
	 * Returns null if file doesn't exist, is empty, or contains invalid JSON
	 */
	static async readSettingsFile(filePath: string): Promise<SettingsJson | null> {
		try {
			if (!(await pathExists(filePath))) {
				return null;
			}
			const content = await readFile(filePath, "utf-8");
			const parsed: unknown = JSON.parse(content);

			// Basic runtime validation - ensure it's an object
			if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
				logger.warning(`Invalid settings file format (expected object): ${filePath}`);
				return null;
			}

			return parsed as SettingsJson;
		} catch (error) {
			logger.warning(`Failed to parse settings file: ${filePath} - ${error}`);
			return null;
		}
	}

	/**
	 * Write settings.json file with proper formatting using atomic write
	 *
	 * Uses write-to-temp-then-rename pattern for safe atomic writes:
	 * 1. Write content to a temp file in the same directory
	 * 2. Rename temp file to target (atomic on POSIX, near-atomic on Windows)
	 * 3. Clean up temp file on failure
	 *
	 * This avoids creating .backup files while ensuring data integrity.
	 */
	static async writeSettingsFile(filePath: string, settings: SettingsJson): Promise<void> {
		const content = JSON.stringify(settings, null, 2);
		await SettingsMerger.atomicWriteFile(filePath, content);
	}

	/**
	 * Atomic file write using temp file + rename
	 *
	 * @param filePath - Target file path
	 * @param content - Content to write
	 * @throws Error if write or rename fails
	 */
	static async atomicWriteFile(filePath: string, content: string): Promise<void> {
		const dir = dirname(filePath);
		const tempPath = join(dir, `.settings-${randomUUID()}.tmp`);

		try {
			// Write to temp file first
			await writeFile(tempPath, content, "utf-8");
			// Atomic rename (same filesystem)
			await rename(tempPath, filePath);
		} catch (error) {
			// Clean up temp file on failure
			try {
				if (await pathExists(tempPath)) {
					await unlink(tempPath);
				}
			} catch {
				// Ignore cleanup errors
			}
			throw error;
		}
	}
}
