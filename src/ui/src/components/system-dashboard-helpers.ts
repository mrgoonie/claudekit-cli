/**
 * Helper functions for MetadataDisplay component
 * Computes ownership counts, category groupings, modification detection, relative time
 */

interface TrackedFile {
	path: string;
	checksum: string;
	ownership: "ck" | "user" | "ck-modified";
	baseChecksum?: string;
}

/** Count files by ownership type */
export function getOwnershipCounts(files: TrackedFile[]): {
	ck: number;
	user: number;
	modified: number;
} {
	let ck = 0;
	let user = 0;
	let modified = 0;
	for (const f of files) {
		if (f.ownership === "ck") ck++;
		else if (f.ownership === "user") user++;
		else if (f.ownership === "ck-modified") modified++;
	}
	return { ck, user, modified };
}

/** Group files by path prefix category */
export function getCategoryCounts(files: TrackedFile[]): Record<string, number> {
	// Count unique top-level directories for skills/commands (not individual files)
	// Count unique top-level directories for skills/commands/hooks (not individual files)
	const skillDirs = new Set<string>();
	const commandDirs = new Set<string>();
	const hookDirs = new Set<string>();
	let rules = 0;
	let settings = 0;
	let other = 0;
	for (const f of files) {
		const p = f.path;
		if (p.startsWith("skills/")) {
			const parts = p.split("/");
			if (parts.length >= 2 && parts[1]) skillDirs.add(parts[1]);
		} else if (p.startsWith("commands/")) {
			const parts = p.split("/");
			if (parts.length >= 2 && parts[1]) commandDirs.add(parts[1]);
		} else if (p.startsWith("hooks/")) {
			// Count unique hook event dirs: "hooks/PreToolUse/script.js" → "PreToolUse"
			const parts = p.split("/");
			if (parts.length >= 2 && parts[1]) hookDirs.add(parts[1]);
		} else if (p === "hooks.json") {
			// hooks.json is a config file, not a hook itself
			settings++;
		} else if (p.startsWith("rules/")) rules++;
		else if (p.startsWith("settings/") || p === "settings.json") settings++;
		else other++;
	}
	return {
		skills: skillDirs.size,
		commands: commandDirs.size,
		rules,
		hooks: hookDirs.size,
		settings,
		other,
	};
}

/** Count files where checksum differs from baseChecksum (user modifications) */
export function getModifiedCount(files: TrackedFile[]): number {
	let count = 0;
	for (const f of files) {
		if (f.baseChecksum && f.checksum !== f.baseChecksum) {
			count++;
		}
	}
	return count;
}

/** Convert ISO timestamp to relative time string + staleness flag */
export function getRelativeTime(isoString: string): {
	label: string;
	isStale: boolean;
} {
	const then = new Date(isoString).getTime();
	const now = Date.now();
	const diffMs = now - then;
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
	const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
	const diffMinutes = Math.floor(diffMs / (1000 * 60));

	let label: string;
	if (diffMinutes < 1) label = "just now";
	else if (diffMinutes < 60) label = `${diffMinutes}m ago`;
	else if (diffHours < 24) label = `${diffHours}h ago`;
	else if (diffDays < 30) label = `${diffDays}d ago`;
	else label = new Date(isoString).toLocaleDateString();

	return { label, isStale: diffDays > 7 };
}
