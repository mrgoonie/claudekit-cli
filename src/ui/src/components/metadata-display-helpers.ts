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
export function getCategoryCounts(
	files: TrackedFile[],
): Record<string, number> {
	const cats: Record<string, number> = {
		skills: 0,
		commands: 0,
		rules: 0,
		hooks: 0,
		settings: 0,
		other: 0,
	};
	for (const f of files) {
		const p = f.path;
		if (p.startsWith("skills/")) cats.skills++;
		else if (p.startsWith("commands/")) cats.commands++;
		else if (p.startsWith("rules/")) cats.rules++;
		else if (p.startsWith("hooks/") || p === "hooks.json") cats.hooks++;
		else if (p.startsWith("settings/") || p === "settings.json") cats.settings++;
		else cats.other++;
	}
	return cats;
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
