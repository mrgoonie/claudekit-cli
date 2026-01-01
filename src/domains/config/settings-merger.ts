/**
 * Settings Merger Facade
 * Handles selective deep merge of settings.json files.
 *
 * Merge strategy:
 * - hooks: Merge arrays, deduplicate by command string
 * - mcp.servers: Preserve user servers, add new CK servers
 * - Other keys: CK-managed keys replace, user-only keys preserved
 */

// Re-export types
export type {
	HookConfig,
	HookEntry,
	McpServerConfig,
	MergeOptions,
	MergeResult,
	SettingsJson,
} from "./merger/types.js";

// Import implementation
import {
	atomicWriteFile as atomicWrite,
	mergeSettings,
	readSettingsFile as readSettings,
	writeSettingsFile as writeSettings,
} from "./merger/index.js";
import type { MergeOptions, MergeResult, SettingsJson } from "./merger/types.js";

/**
 * SettingsMerger - Handles selective deep merge of settings.json
 * Maintains backwards compatibility with static class methods
 */
export class SettingsMerger {
	/**
	 * Deep merge ClaudeKit settings into existing user settings
	 *
	 * @param source - ClaudeKit template settings (new)
	 * @param destination - User's existing settings (current)
	 * @param options - Optional merge options (installed settings for respecting deletions)
	 * @returns Merged settings with stats
	 */
	static merge(
		source: SettingsJson,
		destination: SettingsJson,
		options?: MergeOptions,
	): MergeResult {
		return mergeSettings(source, destination, options);
	}

	/**
	 * Read and parse settings.json file
	 * Returns null if file doesn't exist, is empty, or contains invalid JSON
	 */
	static async readSettingsFile(filePath: string): Promise<SettingsJson | null> {
		return readSettings(filePath);
	}

	/**
	 * Write settings.json file with proper formatting using atomic write
	 */
	static async writeSettingsFile(filePath: string, settings: SettingsJson): Promise<void> {
		return writeSettings(filePath, settings);
	}

	/**
	 * Atomic file write using temp file + rename
	 */
	static async atomicWriteFile(filePath: string, content: string): Promise<void> {
		return atomicWrite(filePath, content);
	}
}
