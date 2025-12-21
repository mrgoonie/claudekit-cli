/**
 * Core merge logic for settings
 */
import { logger } from "@/shared/logger.js";
import { mergeHookEntries } from "./conflict-resolver.js";
import type { HookConfig, HookEntry, MergeResult, SettingsJson } from "./types.js";

/**
 * Merge hooks configurations
 * User hooks are preserved, CK hooks are added (deduplicated by command)
 */
export function mergeHooks(
	sourceHooks: Record<string, HookConfig[] | HookEntry[]>,
	destHooks: Record<string, HookConfig[] | HookEntry[]>,
	result: MergeResult,
): Record<string, HookConfig[] | HookEntry[]> {
	const merged: Record<string, HookConfig[] | HookEntry[]> = { ...destHooks };

	for (const [eventName, sourceEntries] of Object.entries(sourceHooks)) {
		const destEntries = destHooks[eventName] || [];
		merged[eventName] = mergeHookEntries(sourceEntries, destEntries, eventName, result);
	}

	return merged;
}

/**
 * Merge MCP configurations
 * User servers are preserved, new CK servers are added
 */
export function mergeMcp(
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
 * Deep merge ClaudeKit settings into existing user settings
 *
 * @param source - ClaudeKit template settings (new)
 * @param destination - User's existing settings (current)
 * @returns Merged settings with stats
 */
export function mergeSettings(source: SettingsJson, destination: SettingsJson): MergeResult {
	const result: MergeResult = {
		merged: { ...destination },
		hooksAdded: 0,
		hooksPreserved: 0,
		mcpServersPreserved: 0,
		conflictsDetected: [],
	};

	// Merge hooks
	if (source.hooks) {
		result.merged.hooks = mergeHooks(source.hooks, destination.hooks || {}, result);
	}

	// Merge MCP configuration
	if (source.mcp) {
		result.merged.mcp = mergeMcp(source.mcp, destination.mcp || {}, result);
	}

	// Copy other CK-managed keys that don't exist in destination
	for (const key of Object.keys(source)) {
		if (key !== "hooks" && key !== "mcp" && !(key in destination)) {
			result.merged[key] = source[key];
		}
	}

	return result;
}
