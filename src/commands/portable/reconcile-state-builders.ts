import { existsSync, readdirSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { computeContentChecksum } from "./checksum-utils.js";
import { convertItem } from "./converters/index.js";
import {
	buildMergeSectionContent,
	computeManagedSectionChecksums,
	getMergeSectionKey,
} from "./merge-single-sections.js";
import type { PortableInstallationV3 } from "./portable-registry.js";
import { providers } from "./provider-registry.js";
import type { SourceItemState, TargetDirectoryState, TargetFileState } from "./reconcile-types.js";
import type { PortableItem, PortableType, ProviderType } from "./types.js";

type ProviderPathKey = "agents" | "commands" | "skills" | "config" | "rules" | "hooks";

export interface ConversionFallbackWarning {
	item: string;
	type: PortableType;
	provider: ProviderType;
	format: string;
	error: string;
}

function getProviderPathKeyForPortableType(type: PortableType): ProviderPathKey {
	switch (type) {
		case "agent":
			return "agents";
		case "command":
			return "commands";
		case "skill":
			return "skills";
		case "config":
			return "config";
		case "rules":
			return "rules";
		case "hooks":
			return "hooks";
	}
}

function getProviderPathConfig(provider: ProviderType, type: PortableType) {
	return providers[provider]?.[getProviderPathKeyForPortableType(type)] ?? null;
}

function usesMergeSingleChecksums(entry: PortableInstallationV3): boolean {
	const pathConfig = getProviderPathConfig(entry.provider as ProviderType, entry.type);
	return pathConfig?.writeStrategy === "merge-single";
}

function buildTargetChecksum(
	item: PortableItem,
	type: PortableType,
	provider: ProviderType,
	convertedContent: string,
): string | undefined {
	const pathConfig = getProviderPathConfig(provider, type);
	if (!pathConfig) {
		return computeContentChecksum(item.body);
	}

	if (pathConfig.writeStrategy === "yaml-merge" || pathConfig.writeStrategy === "json-merge") {
		return undefined;
	}

	if (pathConfig.writeStrategy !== "merge-single") {
		return computeContentChecksum(convertedContent);
	}

	const sectionKind =
		type === "config" ? "config" : type === "rules" ? "rule" : type === "agent" ? "agent" : null;
	if (!sectionKind) {
		return undefined;
	}

	const sectionKey = getMergeSectionKey(sectionKind, item);
	return computeContentChecksum(
		buildMergeSectionContent(sectionKind, sectionKey, convertedContent),
	);
}

export function buildConvertedChecksums(
	item: PortableItem,
	type: PortableType,
	selectedProviders: ProviderType[],
	options?: {
		onConversionFallback?: (warning: ConversionFallbackWarning) => void;
	},
): Record<string, string> {
	const rawChecksum = computeContentChecksum(item.body);
	const convertedChecksums: Record<string, string> = {};

	for (const provider of selectedProviders) {
		const pathConfig = getProviderPathConfig(provider, type);
		if (!pathConfig) {
			convertedChecksums[provider] = rawChecksum;
			continue;
		}

		const result = convertItem(item, pathConfig.format, provider);
		if (result.error) {
			options?.onConversionFallback?.({
				item: item.name,
				type,
				provider,
				format: pathConfig.format,
				error: result.error,
			});
			convertedChecksums[provider] = rawChecksum;
			continue;
		}

		convertedChecksums[provider] = computeContentChecksum(result.content);
	}

	return convertedChecksums;
}

export function buildSourceItemState(
	item: PortableItem,
	type: PortableType,
	selectedProviders: ProviderType[],
	options?: {
		onConversionFallback?: (warning: ConversionFallbackWarning) => void;
	},
): SourceItemState {
	const rawChecksum = computeContentChecksum(item.body);
	const convertedChecksums = buildConvertedChecksums(item, type, selectedProviders, options);
	const targetChecksums: Record<string, string> = {};

	for (const provider of selectedProviders) {
		const pathConfig = getProviderPathConfig(provider, type);
		if (!pathConfig) {
			targetChecksums[provider] = rawChecksum;
			continue;
		}

		const result = convertItem(item, pathConfig.format, provider);
		if (result.error) {
			targetChecksums[provider] = rawChecksum;
			continue;
		}

		const targetChecksum = buildTargetChecksum(item, type, provider, result.content);
		if (targetChecksum) {
			targetChecksums[provider] = targetChecksum;
		}
	}

	return {
		item: item.name,
		type,
		sourceChecksum: rawChecksum,
		convertedChecksums,
		targetChecksums,
	};
}

// Alias for use by buildTypeDirectoryStates below — points at the canonical
// implementation defined earlier in this file. Keeps a single source of truth
// for PortableType → ProviderPathKey mapping.
const portableTypeToProviderPathKey = getProviderPathKeyForPortableType;

/**
 * Build TargetDirectoryState entries for a set of (provider, type, global) tuples.
 *
 * This function performs filesystem I/O so the reconciler stays pure.
 * Callers pass the result into ReconcileInput.typeDirectoryStates.
 *
 * Skips merge-single and single-file strategies because those write into a shared
 * file rather than a directory of CK-managed files — "empty dir" has no meaning there.
 *
 * @param providerConfigs - provider+global pairs to evaluate
 * @param types - portable types to check for each provider pair
 */
export function buildTypeDirectoryStates(
	providerConfigs: Array<{ provider: ProviderType; global: boolean }>,
	types: PortableType[],
): TargetDirectoryState[] {
	const results: TargetDirectoryState[] = [];

	for (const { provider, global: isGlobal } of providerConfigs) {
		const providerConfig = providers[provider];
		if (!providerConfig) continue;

		for (const type of types) {
			const pathKey = portableTypeToProviderPathKey(type);
			const pathConfig = providerConfig[pathKey];
			if (!pathConfig) continue;

			// Skip merge-single and single-file strategies:
			// those write into a shared file, not a directory of per-item files.
			// "isEmpty" is not meaningful for them — they go through normal flow.
			if (
				pathConfig.writeStrategy === "merge-single" ||
				pathConfig.writeStrategy === "single-file"
			) {
				continue;
			}

			const dirPath = isGlobal ? pathConfig.globalPath : pathConfig.projectPath;
			if (!dirPath) continue;

			const exists = existsSync(dirPath);

			if (!exists) {
				results.push({
					provider,
					type,
					global: isGlobal,
					path: dirPath,
					exists: false,
					isEmpty: true,
					fileCount: 0,
				});
				continue;
			}

			// Single-file config (e.g. CLAUDE.md for claude-code) may be a file, not a dir.
			// If the path resolves to a file, treat isEmpty based on existence only.
			let stat: ReturnType<typeof statSync> | null = null;
			try {
				stat = statSync(dirPath);
			} catch {
				// Can't stat — treat as missing
				results.push({
					provider,
					type,
					global: isGlobal,
					path: dirPath,
					exists: false,
					isEmpty: true,
					fileCount: 0,
				});
				continue;
			}

			if (!stat.isDirectory()) {
				// It's a file — existence check only, isEmpty = !exists
				results.push({
					provider,
					type,
					global: isGlobal,
					path: dirPath,
					exists: true,
					isEmpty: false,
					fileCount: 1,
				});
				continue;
			}

			// Directory: count files with CK-managed extensions
			const ext = pathConfig.fileExtension ?? "";
			let entries: string[] = [];
			try {
				entries = readdirSync(dirPath);
			} catch {
				// Can't read — treat as empty
				results.push({
					provider,
					type,
					global: isGlobal,
					path: dirPath,
					exists: true,
					isEmpty: true,
					fileCount: 0,
				});
				continue;
			}

			// Filter to CK-managed extensions.
			// When fileExtension is "" (e.g. hooks with mixed .json/.sh/.js), count all files.
			const managedFiles =
				ext === ""
					? entries.filter((f) => {
							// Hooks: count .json, .sh, and .js files (CK-shipped extensions)
							return f.endsWith(".json") || f.endsWith(".sh") || f.endsWith(".js");
						})
					: entries.filter((f) => f.endsWith(ext));

			results.push({
				provider,
				type,
				global: isGlobal,
				path: dirPath,
				exists: true,
				isEmpty: managedFiles.length === 0,
				fileCount: managedFiles.length,
			});
		}
	}

	return results;
}

export async function buildTargetStates(
	entries: PortableInstallationV3[],
	options?: {
		onReadFailure?: (path: string, error: unknown) => void;
	},
): Promise<Map<string, TargetFileState>> {
	const targetStates = new Map<string, TargetFileState>();
	const entriesByPath = new Map<string, PortableInstallationV3[]>();

	for (const entry of entries) {
		if (entry.type === "skill") continue;
		const group = entriesByPath.get(entry.path) ?? [];
		group.push(entry);
		entriesByPath.set(entry.path, group);
	}

	for (const [entryPath, groupedEntries] of entriesByPath) {
		const exists = existsSync(entryPath);
		const state: TargetFileState = { path: entryPath, exists };

		if (exists) {
			try {
				const content = await readFile(entryPath, "utf-8");
				state.currentChecksum = computeContentChecksum(content);
				if (groupedEntries.some((entry) => usesMergeSingleChecksums(entry))) {
					state.sectionChecksums = computeManagedSectionChecksums(content);
				}
			} catch (error) {
				options?.onReadFailure?.(entryPath, error);
			}
		}

		targetStates.set(entryPath, state);
	}

	return targetStates;
}
