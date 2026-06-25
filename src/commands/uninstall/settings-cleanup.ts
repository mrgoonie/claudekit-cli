/**
 * Settings Cleanup (uninstall)
 *
 * Reverses the settings.json mutations that `ck init` performed. Install records every
 * hook command and MCP server it writes into settings.json inside `.ck.json`
 * (InstalledSettingsTracker). Uninstall reads that tracking back and removes exactly those
 * entries from settings.json, then clears the corresponding `.ck.json` tracking.
 *
 * Safety rules:
 * - Only remove hook/MCP entries whose normalized command matches what CK tracked installing.
 *   User-authored or user-edited entries never match and are preserved.
 * - For kit-scoped uninstall, an entry still tracked by a remaining kit is preserved (shared).
 * - User hook enable/disable preferences (top-level `hooks` map in `.ck.json`) are preserved.
 */

import { join } from "node:path";
import { type SettingsJson, SettingsMerger } from "@/domains/config/settings-merger.js";
import { normalizeCommand } from "@/shared/command-normalizer.js";
import { parseJsonContent } from "@/shared/json-content.js";
import { logger } from "@/shared/logger.js";
import type { InstalledSettings, KitType } from "@/types";
import { pathExists, readFile, remove, writeFile } from "fs-extra";

const CK_JSON_FILE = ".ck.json";
const SETTINGS_FILE = "settings.json";

interface CkJsonData {
	kits?: Record<string, { installedSettings?: InstalledSettings; [key: string]: unknown }>;
	[key: string]: unknown;
}

export interface SettingsCleanupResult {
	hooksRemoved: number;
	mcpServersRemoved: number;
	settingsFileRemoved: boolean;
	ckJsonRemoved: boolean;
}

const EMPTY_RESULT: SettingsCleanupResult = {
	hooksRemoved: 0,
	mcpServersRemoved: 0,
	settingsFileRemoved: false,
	ckJsonRemoved: false,
};

export interface SettingsCleanupOptions {
	/** Kit being removed. Undefined means a full uninstall of every tracked kit. */
	kit?: KitType;
	/** Kits that remain installed after this uninstall (their entries must be preserved). */
	remainingKits: KitType[];
	/** When true, compute counts but do not write/delete anything. */
	dryRun?: boolean;
}

/**
 * Resolve which tracked hook commands (normalized) and MCP server names should be removed
 * from settings.json for this uninstall, excluding anything a remaining kit still owns.
 */
function resolveRemovalTargets(
	kits: Record<string, { installedSettings?: InstalledSettings }>,
	removedKitNames: string[],
	remainingKits: KitType[],
): { hooks: Set<string>; servers: Set<string> } {
	const retainedHooks = new Set<string>();
	const retainedServers = new Set<string>();
	for (const remainingKit of remainingKits) {
		const installed = kits[remainingKit]?.installedSettings;
		for (const command of installed?.hooks ?? []) {
			const normalized = normalizeCommand(command);
			if (normalized) retainedHooks.add(normalized);
		}
		for (const server of installed?.mcpServers ?? []) {
			retainedServers.add(server);
		}
	}

	const hooks = new Set<string>();
	const servers = new Set<string>();
	for (const kitName of removedKitNames) {
		const installed = kits[kitName]?.installedSettings;
		for (const command of installed?.hooks ?? []) {
			const normalized = normalizeCommand(command);
			if (normalized && !retainedHooks.has(normalized)) hooks.add(normalized);
		}
		for (const server of installed?.mcpServers ?? []) {
			if (!retainedServers.has(server)) servers.add(server);
		}
	}

	return { hooks, servers };
}

/**
 * Remove hook entries whose normalized command matches one of `normalizedToRemove`.
 * Handles both HookConfig (nested `hooks` array) and bare HookEntry shapes, and prunes
 * empty hook configs / empty event arrays / an empty `hooks` key.
 * @returns number of individual hooks removed
 */
function removeHooksFromSettings(settings: SettingsJson, normalizedToRemove: Set<string>): number {
	if (!settings.hooks || normalizedToRemove.size === 0) return 0;

	let removed = 0;
	const eventKeysToDelete: string[] = [];

	for (const [eventName, entries] of Object.entries(settings.hooks)) {
		const keptEntries: Array<Record<string, unknown>> = [];

		for (const entry of entries as Array<Record<string, unknown>>) {
			if (Array.isArray(entry.hooks)) {
				const keptHooks = (entry.hooks as Array<{ command?: unknown }>).filter((hook) => {
					if (
						typeof hook.command === "string" &&
						normalizedToRemove.has(normalizeCommand(hook.command))
					) {
						removed++;
						return false;
					}
					return true;
				});
				// Drop the whole config when all of its hooks were CK-installed and removed.
				if (keptHooks.length > 0) {
					keptEntries.push({ ...entry, hooks: keptHooks });
				}
				continue;
			}

			if (
				typeof entry.command === "string" &&
				normalizedToRemove.has(normalizeCommand(entry.command))
			) {
				removed++;
				continue;
			}

			keptEntries.push(entry);
		}

		if (keptEntries.length > 0) {
			(settings.hooks as Record<string, unknown>)[eventName] = keptEntries;
		} else {
			eventKeysToDelete.push(eventName);
		}
	}

	for (const eventName of eventKeysToDelete) {
		delete settings.hooks[eventName];
	}
	if (Object.keys(settings.hooks).length === 0) {
		Reflect.deleteProperty(settings, "hooks");
	}

	return removed;
}

/**
 * Remove tracked MCP servers from settings.mcp.servers, pruning empty `servers`/`mcp` keys.
 * @returns number of servers removed
 */
function removeMcpServersFromSettings(
	settings: SettingsJson,
	serversToRemove: Set<string>,
): number {
	const servers = settings.mcp?.servers;
	if (!servers || serversToRemove.size === 0) return 0;

	let removed = 0;
	for (const name of serversToRemove) {
		if (Object.hasOwn(servers, name)) {
			delete servers[name];
			removed++;
		}
	}

	if (removed > 0 && settings.mcp) {
		if (Object.keys(servers).length === 0) {
			Reflect.deleteProperty(settings.mcp, "servers");
		}
		if (Object.keys(settings.mcp).length === 0) {
			Reflect.deleteProperty(settings, "mcp");
		}
	}

	return removed;
}

/**
 * Remove the uninstalled kit(s) from `.ck.json` tracking. Deletes the file entirely when no
 * kits remain and no other top-level keys (e.g. user hook-disable prefs) exist.
 * @returns true if the `.ck.json` file was deleted
 */
async function cleanupCkJson(
	ckJsonPath: string,
	data: CkJsonData,
	removedKitNames: string[],
	dryRun: boolean,
): Promise<boolean> {
	if (!data.kits) return false;

	for (const kitName of removedKitNames) {
		delete data.kits[kitName];
	}

	const noKitsLeft = Object.keys(data.kits).length === 0;
	const otherTopLevelKeys = Object.keys(data).filter((key) => key !== "kits");

	if (dryRun) return noKitsLeft && otherTopLevelKeys.length === 0;

	if (noKitsLeft && otherTopLevelKeys.length === 0) {
		await remove(ckJsonPath);
		return true;
	}

	if (noKitsLeft) {
		Reflect.deleteProperty(data, "kits");
	}
	await writeFile(ckJsonPath, JSON.stringify(data, null, 2), "utf-8");
	return false;
}

/**
 * Reverse settings.json mutations and clear `.ck.json` tracking for an uninstalled scope.
 * No-op (zero result) when `.ck.json` does not exist (nothing was ever tracked).
 *
 * @param installationPath - The `.claude` directory of the installation (local or global)
 */
export async function cleanupUninstalledSettings(
	installationPath: string,
	options: SettingsCleanupOptions,
): Promise<SettingsCleanupResult> {
	const ckJsonPath = join(installationPath, CK_JSON_FILE);
	if (!(await pathExists(ckJsonPath))) {
		return { ...EMPTY_RESULT };
	}

	let data: CkJsonData;
	try {
		data = parseJsonContent<CkJsonData>(await readFile(ckJsonPath, "utf-8"));
	} catch (error) {
		logger.debug(
			`Settings cleanup: failed to parse ${ckJsonPath}: ${
				error instanceof Error ? error.message : "unknown error"
			}`,
		);
		return { ...EMPTY_RESULT };
	}

	const kits = data.kits ?? {};
	const removedKitNames = options.kit ? [options.kit] : Object.keys(kits);
	const { hooks, servers } = resolveRemovalTargets(kits, removedKitNames, options.remainingKits);

	const result: SettingsCleanupResult = { ...EMPTY_RESULT };
	const settingsPath = join(installationPath, SETTINGS_FILE);
	const settings = await SettingsMerger.readSettingsFile(settingsPath);

	if (settings) {
		result.hooksRemoved = removeHooksFromSettings(settings, hooks);
		result.mcpServersRemoved = removeMcpServersFromSettings(settings, servers);

		if (!options.dryRun && (result.hooksRemoved > 0 || result.mcpServersRemoved > 0)) {
			if (Object.keys(settings).length === 0) {
				await remove(settingsPath);
				result.settingsFileRemoved = true;
			} else {
				await SettingsMerger.writeSettingsFile(settingsPath, settings);
			}
		}
	}

	result.ckJsonRemoved = await cleanupCkJson(
		ckJsonPath,
		data,
		removedKitNames,
		options.dryRun ?? false,
	);

	return result;
}
