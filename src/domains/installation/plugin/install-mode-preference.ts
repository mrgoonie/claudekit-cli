import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { InstallModePreference, KitType, Metadata } from "@/types";

export type EffectiveInstallModePreference = Exclude<InstallModePreference, "auto">;

export const DEFAULT_INSTALL_MODE_PREFERENCE: EffectiveInstallModePreference = "legacy";

export function normalizeInstallModePreference(value: unknown): InstallModePreference | null {
	if (value === "auto" || value === "plugin" || value === "legacy") return value;
	return null;
}

/** Only plugin is durable consent. Compatibility values and missing state mean normal skills. */
export function resolveEffectiveInstallModePreference(
	value: InstallModePreference | null | undefined,
): EffectiveInstallModePreference {
	return value === "plugin" ? "plugin" : "legacy";
}

export function readInstallModePreferenceFromMetadata(
	metadata: Metadata | null | undefined,
	kit: KitType = "engineer",
): InstallModePreference | null {
	return normalizeInstallModePreference(metadata?.kits?.[kit]?.installModePreference);
}

export function resolveInstallModePreferenceForUpdate(
	metadata: Metadata | null | undefined,
	kit: KitType | undefined,
): EffectiveInstallModePreference | undefined {
	if (kit !== "engineer") return undefined;
	return resolveEffectiveInstallModePreference(
		readInstallModePreferenceFromMetadata(metadata, kit),
	);
}

export function readInstallModePreferenceFromClaudeDir(
	claudeDir: string,
	kit: KitType = "engineer",
): InstallModePreference | null {
	try {
		const parsed = JSON.parse(readFileSync(join(claudeDir, "metadata.json"), "utf-8")) as Metadata;
		return readInstallModePreferenceFromMetadata(parsed, kit);
	} catch {
		return null;
	}
}

/** Read-only identity probe that survives an absent or malformed preference field. */
export function hasKitMetadataInClaudeDir(claudeDir: string, kit: KitType = "engineer"): boolean {
	try {
		const parsed = JSON.parse(readFileSync(join(claudeDir, "metadata.json"), "utf-8")) as unknown;
		if (!isRecord(parsed) || !isRecord(parsed.kits)) return false;
		return isRecord(parsed.kits[kit]);
	} catch {
		return false;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
