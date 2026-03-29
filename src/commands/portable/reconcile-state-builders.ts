import { existsSync } from "node:fs";
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
import type { SourceItemState, TargetFileState } from "./reconcile-types.js";
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
