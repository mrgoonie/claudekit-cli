import type { KitType } from "@/types";

const LEGACY_COMMAND_PREFIX_BY_KIT: Partial<Record<KitType, string>> = {
	engineer: "ck",
	marketing: "mkt",
};

function getLegacyCommandPrefix(kitType?: KitType): string | null {
	if (!kitType) return null;
	return LEGACY_COMMAND_PREFIX_BY_KIT[kitType] ?? null;
}

function canExpandLegacyCommandPattern(pattern: string, prefix: string): boolean {
	if (!pattern.startsWith("commands/")) return false;
	if (pattern.startsWith(`commands/${prefix}/`)) return false;
	if (pattern.startsWith("commands/ck/")) return false;
	if (pattern.startsWith("commands/mkt/")) return false;
	return true;
}

/**
 * Expand deletion patterns so deprecated command paths also match legacy prefixed installs.
 *
 * Older `--prefix` installs moved commands from `commands/foo.md` to `commands/ck/foo.md`
 * (and `commands/mkt/` for marketing). Newer kits may delete only the unprefixed source path,
 * so upgrades need to consider both locations.
 */
export function expandDeletionPatterns(patterns: string[], kitType?: KitType): string[] {
	const prefix = getLegacyCommandPrefix(kitType);
	if (!prefix || patterns.length === 0) {
		return [...patterns];
	}

	const expanded = new Set<string>();

	for (const pattern of patterns) {
		expanded.add(pattern);

		if (canExpandLegacyCommandPattern(pattern, prefix)) {
			expanded.add(`commands/${prefix}/${pattern.slice("commands/".length)}`);
		}
	}

	return [...expanded];
}
