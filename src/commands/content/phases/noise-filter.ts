/**
 * Filter out noise commits that are unlikely to produce content-worthy social posts.
 * Separates noise heuristics from the change detector for testability.
 */

/** Returns true for commits that are unlikely to be content-worthy. */
export function isNoiseCommit(title: string, author: string): boolean {
	const lower = title.toLowerCase();
	if (author.toLowerCase().includes("dependabot")) return true;
	if (lower.startsWith("merge ")) return true;
	if (lower.startsWith("chore:") || lower.startsWith("docs:") || lower.startsWith("style:"))
		return true;
	if (lower.includes("readme") && lower.includes("typo")) return true;
	return false;
}
