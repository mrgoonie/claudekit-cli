/**
 * Plan directory finder — locates /ck:plan output directories on disk
 * Scans plans/ for recently created directories containing plan.md
 */

import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { WatchLogger } from "./watch-logger.js";

/**
 * Find a recently created plan directory matching an issue number
 * Scans plans/ for directories created in the last 10 minutes containing plan.md
 */
export async function findRecentPlanDir(
	cwd: string,
	issueNumber: number,
	watchLog: WatchLogger,
): Promise<string | null> {
	const plansRoot = join(cwd, "plans");
	try {
		const entries = await readdir(plansRoot);
		const tenMinAgo = Date.now() - 10 * 60 * 1000;
		const issueStr = String(issueNumber);

		const candidates: { dir: string; mtime: number }[] = [];
		for (const entry of entries) {
			if (entry === "watch" || entry === "reports" || entry === "visuals") continue;
			const dirPath = join(plansRoot, entry);
			const dirStat = await stat(dirPath);
			if (!dirStat.isDirectory()) continue;
			if (dirStat.mtimeMs < tenMinAgo) continue;

			// Check if directory contains plan.md
			try {
				await stat(join(dirPath, "plan.md"));
			} catch {
				continue;
			}

			const nameMatchesIssue =
				entry.includes(`issue-${issueStr}`) ||
				entry.includes(`-${issueStr}-`) ||
				entry.endsWith(`-${issueStr}`);

			candidates.push({ dir: dirPath, mtime: dirStat.mtimeMs });

			// Strong match by name
			if (nameMatchesIssue) {
				watchLog.info(`Plan dir matched by name: ${dirPath}`);
				return dirPath;
			}
		}

		// Return the most recently created plan directory as fallback
		if (candidates.length > 0) {
			candidates.sort((a, b) => b.mtime - a.mtime);
			watchLog.info(`Plan dir matched by recency: ${candidates[0].dir}`);
			return candidates[0].dir;
		}
	} catch {
		// plans/ directory may not exist
	}
	return null;
}
