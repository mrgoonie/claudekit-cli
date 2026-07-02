import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { InstallModePreference, KitType, Metadata } from "@/types";

export const DEFAULT_INSTALL_MODE_PREFERENCE: InstallModePreference = "auto";

export function normalizeInstallModePreference(value: unknown): InstallModePreference | null {
	if (value === "auto" || value === "plugin" || value === "legacy") return value;
	return null;
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
): InstallModePreference | undefined {
	if (kit !== "engineer") return undefined;
	return readInstallModePreferenceFromMetadata(metadata, kit) ?? DEFAULT_INSTALL_MODE_PREFERENCE;
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
