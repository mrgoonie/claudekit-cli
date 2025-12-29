/**
 * Core merge logic for settings
 */
import { logger } from "@/shared/logger.js";
import { mergeHookEntries } from "./conflict-resolver.js";
import type { HookConfig, HookEntry, MergeOptions, MergeResult, SettingsJson } from "./types.js";

/**
 * Merge hooks configurations
 * User hooks are preserved, CK hooks are added (deduplicated by command)
 * Respects user deletions when installedSettings is provided
 */
export function mergeHooks(
	sourceHooks: Record<string, HookConfig[] | HookEntry[]>,
	destHooks: Record<string, HookConfig[] | HookEntry[]>,
	result: MergeResult,
	options?: MergeOptions,
): Record<string, HookConfig[] | HookEntry[]> {
	const merged: Record<string, HookConfig[] | HookEntry[]> = { ...destHooks };
	const installedHooks = options?.installedSettings?.hooks ?? [];

	for (const [eventName, sourceEntries] of Object.entries(sourceHooks)) {
		const destEntries = destHooks[eventName] || [];
		merged[eventName] = mergeHookEntries(
			sourceEntries,
			destEntries,
			eventName,
			result,
			installedHooks,
		);
	}

	return merged;
}

/**
 * Merge MCP configurations
 * User servers are preserved, new CK servers are added
 * Respects user deletions when installedSettings is provided
 */
export function mergeMcp(
	sourceMcp: SettingsJson["mcp"],
	destMcp: SettingsJson["mcp"],
	result: MergeResult,
	options?: MergeOptions,
): SettingsJson["mcp"] {
	if (!sourceMcp) return destMcp;
	if (!destMcp) return sourceMcp;

	const merged: SettingsJson["mcp"] = { ...destMcp };
	const installedServers = options?.installedSettings?.mcpServers ?? [];

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
				// Check if user previously had this and removed it
				const wasInstalled = installedServers.includes(serverName);
				if (wasInstalled) {
					// User removed it intentionally - respect deletion
					result.mcpServersSkipped++;
					logger.verbose(`Skipping MCP server (user removed): ${serverName}`);
				} else {
					// New server that user never had - add it
					merged.servers[serverName] = serverConfig;
					result.newlyInstalledServers.push(serverName);
					logger.debug(`Added ClaudeKit MCP server: ${serverName}`);
				}
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
 * Deep merge ClaudeKit settings into existing user settings
 *
 * @param source - ClaudeKit template settings (new)
 * @param destination - User's existing settings (current)
 * @param options - Merge options including installed settings for respecting deletions
 * @returns Merged settings with stats
 */
export function mergeSettings(
	source: SettingsJson,
	destination: SettingsJson,
	options?: MergeOptions,
): MergeResult {
	const result: MergeResult = {
		merged: { ...destination },
		hooksAdded: 0,
		hooksPreserved: 0,
		hooksSkipped: 0,
		mcpServersPreserved: 0,
		mcpServersSkipped: 0,
		conflictsDetected: [],
		newlyInstalledHooks: [],
		newlyInstalledServers: [],
	};

	// Merge hooks
	if (source.hooks) {
		result.merged.hooks = mergeHooks(source.hooks, destination.hooks || {}, result, options);
	}

	// Merge MCP configuration
	if (source.mcp) {
		result.merged.mcp = mergeMcp(source.mcp, destination.mcp || {}, result, options);
	}

	// Copy other CK-managed keys that don't exist in destination
	for (const key of Object.keys(source)) {
		if (key !== "hooks" && key !== "mcp" && !(key in destination)) {
			result.merged[key] = source[key];
		}
	}

	return result;
}
