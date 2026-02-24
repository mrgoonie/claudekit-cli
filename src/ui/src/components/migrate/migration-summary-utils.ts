import type { MigrationResultEntry } from "@/types";
import type { TranslationKey } from "../../i18n";

export type StatusFilter = "all" | "installed" | "skipped" | "failed";
export type GroupablePortableType = "agent" | "command" | "skill" | "config" | "rules" | "unknown";

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

const DISALLOWED_FORMAT_CODE_POINTS = new Set([
	0x200b, // ZERO WIDTH SPACE
	0x200c, // ZERO WIDTH NON-JOINER
	0x200d, // ZERO WIDTH JOINER
	0x2060, // WORD JOINER
	0xfeff, // ZERO WIDTH NO-BREAK SPACE (BOM)
	0x2028, // LINE SEPARATOR
	0x2029, // PARAGRAPH SEPARATOR
	0x202a, // LRE
	0x202b, // RLE
	0x202c, // PDF
	0x202d, // LRO
	0x202e, // RLO
	0x2066, // LRI
	0x2067, // RLI
	0x2068, // FSI
	0x2069, // PDI
]);

function isDisallowedControlCode(codePoint: number): boolean {
	// Treat tabs/newlines as unsafe for display-only fields to avoid layout/control rendering abuse.
	if (codePoint === 0x09 || codePoint === 0x0a || codePoint === 0x0d) {
		return true;
	}

	return (
		(codePoint >= 0x00 && codePoint <= 0x08) ||
		(codePoint >= 0x0b && codePoint <= 0x1f) ||
		(codePoint >= 0x7f && codePoint <= 0x9f) ||
		DISALLOWED_FORMAT_CODE_POINTS.has(codePoint)
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
	return normalized;
}

export function getResultStatus(result: MigrationResultEntry): StatusFilter {
	if (!result.success) return "failed";
	if (result.skipped) return "skipped";
	return "installed";
}

export function getSummaryCounts(results: MigrationResultEntry[]): {
	installed: number;
	skipped: number;
	failed: number;
} {
	const counts = { installed: 0, skipped: 0, failed: 0 };
	for (const result of results) {
		const status = getResultStatus(result);
		if (status === "installed") counts.installed += 1;
		else if (status === "skipped") counts.skipped += 1;
		else counts.failed += 1;
	}
	return counts;
}

export function normalizePortableType(
	portableType: MigrationResultEntry["portableType"] | string | undefined,
): GroupablePortableType {
	switch (portableType) {
		case "agent":
		case "command":
		case "skill":
		case "config":
		case "rules":
		case "unknown":
			return portableType;
		default:
			return "unknown";
	}
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
		const type = normalizePortableType(result.portableType);
		const group = groups.get(type) || [];
		group.push(result);
		groups.set(type, group);
	}
	return groups;
}

export function getResultRowKey(result: MigrationResultEntry): string {
	const parts: Array<string | boolean | undefined> = [
		normalizePortableType(result.portableType),
		result.provider,
		result.providerDisplayName,
		result.itemName,
		result.path,
		result.success,
		result.skipped,
		result.overwritten,
		result.error,
		result.skipReason,
	];

	return parts.map((part) => (part === undefined ? "" : String(part))).join("|");
}

export function isSingleProvider(results: MigrationResultEntry[]): boolean {
	if (results.length === 0) return true;
	const firstProvider = results[0].provider;
	return results.every((entry) => entry.provider === firstProvider);
}
