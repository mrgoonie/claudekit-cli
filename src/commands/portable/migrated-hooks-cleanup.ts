import { isAbsolute, resolve } from "node:path";
import { isGeneratedContextHookName } from "./generated-context-hooks.js";
import { pruneSettingsHooks, removeHookFiles } from "./migrated-hook-settings-cleanup.js";
import { removeInstallationsByFilter } from "./portable-registry.js";
import { providers } from "./provider-registry.js";
import type { ProviderType } from "./types.js";

export interface MigratedHookCleanupResult {
	provider: ProviderType;
	global: boolean;
	settingsPath: string | null;
	hooksPruned: number;
	filesRemoved: number;
	registryEntriesRemoved: number;
	warnings: string[];
}

export interface MigratedHookCleanupOptions {
	global: boolean;
	pruneRegistry?: boolean;
}

export { isGeneratedContextHookName } from "./generated-context-hooks.js";

export async function cleanupMigratedHooksForProviders(
	providerIds: string[],
	options: MigratedHookCleanupOptions,
): Promise<MigratedHookCleanupResult[]> {
	const uniqueProviders = Array.from(new Set(providerIds));
	const results: MigratedHookCleanupResult[] = [];

	for (const providerId of uniqueProviders) {
		if (!(providerId in providers)) continue;
		const provider = providerId as ProviderType;
		const config = providers[provider];
		if (!config.hooks && !config.settingsJsonPath) continue;

		results.push(await cleanupMigratedHooksForProvider(provider, options));
	}

	return results;
}

async function cleanupMigratedHooksForProvider(
	provider: ProviderType,
	options: MigratedHookCleanupOptions,
): Promise<MigratedHookCleanupResult> {
	const config = providers[provider];
	const hooksDir = resolveProviderPath(
		options.global ? config.hooks?.globalPath : config.hooks?.projectPath,
	);
	const settingsPath = resolveProviderPath(
		options.global ? config.settingsJsonPath?.globalPath : config.settingsJsonPath?.projectPath,
	);
	const warnings: string[] = [];
	const filesToRemove = new Set<string>();
	let hooksPruned = 0;

	if (settingsPath && hooksDir) {
		const pruned = await pruneSettingsHooks(settingsPath, hooksDir);
		hooksPruned = pruned.hooksPruned;
		for (const filePath of pruned.filesToRemove) filesToRemove.add(filePath);
		warnings.push(...pruned.warnings);
	}

	let registryEntriesRemoved = 0;
	if (options.pruneRegistry !== false) {
		try {
			const removed = await removeInstallationsByFilter(
				(entry) =>
					entry.type === "hooks" &&
					entry.provider === provider &&
					entry.global === options.global &&
					(isGeneratedContextHookName(entry.item) ||
						isGeneratedContextHookName(entry.path) ||
						isGeneratedContextHookName(entry.sourcePath)),
			);
			registryEntriesRemoved = removed.length;
			for (const entry of removed) filesToRemove.add(entry.path);
		} catch (error) {
			warnings.push(
				`Registry cleanup failed for ${provider}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	const filesRemoved = hooksDir ? await removeHookFiles(filesToRemove, hooksDir) : 0;

	return {
		provider,
		global: options.global,
		settingsPath: settingsPath ?? null,
		hooksPruned,
		filesRemoved,
		registryEntriesRemoved,
		warnings,
	};
}

function resolveProviderPath(pathValue: string | null | undefined): string | null {
	if (!pathValue) return null;
	return isAbsolute(pathValue) ? pathValue : resolve(process.cwd(), pathValue);
}
