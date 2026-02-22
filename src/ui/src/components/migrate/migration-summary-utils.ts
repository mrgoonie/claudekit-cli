import type { MigrationResultEntry } from "@/types";
import type { TranslationKey } from "../../i18n";

export type StatusFilter = "all" | "installed" | "skipped" | "failed";

export const TYPE_CONFIG: Array<{
	key: string;
	labelKey: TranslationKey;
	badgeClass: string;
}> = [
	{
		key: "agent",
		labelKey: "migrateTypeAgents",
		badgeClass: "border-dash-accent/30 text-dash-accent",
	},
	{
		key: "command",
		labelKey: "migrateTypeCommands",
		badgeClass: "border-yellow-500/30 text-yellow-400",
	},
	{
		key: "skill",
		labelKey: "migrateTypeSkills",
		badgeClass: "border-purple-500/30 text-purple-400",
	},
	{
		key: "config",
		labelKey: "migrateTypeConfig",
		badgeClass: "border-teal-500/30 text-teal-400",
	},
	{
		key: "rules",
		labelKey: "migrateTypeRules",
		badgeClass: "border-rose-500/30 text-rose-400",
	},
];

function isDisallowedControlCode(codePoint: number): boolean {
	return (
		(codePoint >= 0x00 && codePoint <= 0x08) ||
		(codePoint >= 0x0b && codePoint <= 0x1f) ||
		(codePoint >= 0x7f && codePoint <= 0x9f)
	);
}

export function sanitizeDisplayString(value: string): string {
	let output = "";
	for (const char of value) {
		const codePoint = char.codePointAt(0);
		if (codePoint === undefined) continue;
		if (!isDisallowedControlCode(codePoint)) {
			output += char;
		}
	}
	return output;
}

/** Shorten absolute path to relative from provider config dir */
export function shortenPath(fullPath: string): string {
	if (!fullPath) return "-";
	const normalized = fullPath.replace(/\\/g, "/");
	// Match the last dotdir segment (e.g. .codex/, .claude/, .cursor/)
	const dotDirMatch = normalized.match(/.*\/(\.[^/]+\/)/);
	if (dotDirMatch?.[1]) {
		const idx = (dotDirMatch.index ?? 0) + dotDirMatch[0].length - dotDirMatch[1].length;
		return normalized.slice(idx);
	}
	// Fallback: show last 3 segments
	const segments = normalized.split("/");
	if (segments.length > 3) {
		return `.../${segments.slice(-3).join("/")}`;
	}
	return fullPath;
}

export function getResultStatus(result: MigrationResultEntry): StatusFilter {
	if (!result.success) return "failed";
	if (result.skipped) return "skipped";
	return "installed";
}

export function getStatusDisplay(
	status: StatusFilter,
	t: (key: TranslationKey) => string,
): { label: string; className: string } {
	switch (status) {
		case "failed":
			return {
				label: t("migrateStatusFailed"),
				className: "border-red-500/30 bg-red-500/10 text-red-400",
			};
		case "skipped":
			return {
				label: t("migrateStatusSkipped"),
				className: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
			};
		default:
			return {
				label: t("migrateStatusInstalled"),
				className: "border-green-500/30 bg-green-500/10 text-green-400",
			};
	}
}

export function groupByType(results: MigrationResultEntry[]): Map<string, MigrationResultEntry[]> {
	const groups = new Map<string, MigrationResultEntry[]>();
	for (const result of results) {
		const type = result.portableType || "unknown";
		const group = groups.get(type) || [];
		group.push(result);
		groups.set(type, group);
	}
	return groups;
}

export function isSingleProvider(results: MigrationResultEntry[]): boolean {
	if (results.length === 0) return true;
	const firstProvider = results[0].provider;
	return results.every((entry) => entry.provider === firstProvider);
}
