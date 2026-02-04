/**
 * Enhanced project discovery combining session and history sources
 */

import { constants, access } from "node:fs/promises";
import { basename } from "node:path";
import { parseHistoryFile } from "./history-parser.js";
import type { DiscoveredProject, HistoryProject, ProjectDiscoveryResult } from "./types.js";

/**
 * Discover projects from history.jsonl
 */
export async function discoverProjectsFromHistory(): Promise<HistoryProject[]> {
	const result = await parseHistoryFile();
	return result.projects;
}

/**
 * Check if path exists on filesystem
 */
async function pathExists(path: string): Promise<boolean> {
	try {
		await access(path, constants.F_OK);
		return true;
	} catch {
		return false;
	}
}

/**
 * Merge session-based and history-based project discovery
 * @param sessionProjects - Projects from session file scanning
 * @param filterNonExistent - If true, exclude paths that don't exist
 * @param historyPath - Optional path to history.jsonl (for testing)
 */
export async function mergeProjectDiscovery(
	sessionProjects: Array<{ path: string; lastUsed?: number }>,
	filterNonExistent = false,
	historyPath?: string,
): Promise<ProjectDiscoveryResult> {
	const start = Date.now();
	let error: string | undefined;

	try {
		// Get history projects
		const historyResult = await parseHistoryFile(historyPath);
		if (historyResult.error) {
			error = historyResult.error;
		}

		const historyMap = new Map<string, HistoryProject>();
		for (const p of historyResult.projects) {
			historyMap.set(p.path, p);
		}

		// Build unified map
		const projectMap = new Map<string, DiscoveredProject>();

		// Add session projects
		for (const sp of sessionProjects) {
			const existing = projectMap.get(sp.path);
			if (!existing) {
				projectMap.set(sp.path, {
					path: sp.path,
					name: basename(sp.path),
					lastUsed: sp.lastUsed ?? null,
					source: "session",
					exists: true, // assume session data implies existence
				});
			}
		}

		// Merge/add history projects
		for (const [path, hp] of historyMap) {
			const existing = projectMap.get(path);
			if (existing) {
				existing.source = "both";
				existing.interactionCount = hp.interactionCount;
				// Prefer history lastUsed if more recent
				if (hp.lastUsed > (existing.lastUsed ?? 0)) {
					existing.lastUsed = hp.lastUsed;
				}
			} else {
				projectMap.set(path, {
					path,
					name: basename(path),
					lastUsed: hp.lastUsed,
					source: "history",
					exists: false, // will check below
					interactionCount: hp.interactionCount,
				});
			}
		}

		// Check existence for history-only projects in parallel
		const projects = Array.from(projectMap.values());
		await Promise.all(
			projects
				.filter((p) => p.source === "history")
				.map(async (p) => {
					p.exists = await pathExists(p.path);
				}),
		);

		// Filter and sort
		let result = projects;
		if (filterNonExistent) {
			result = result.filter((p) => p.exists);
		}
		result.sort((a, b) => (b.lastUsed ?? 0) - (a.lastUsed ?? 0));

		return {
			projects: result,
			totalFromSessions: sessionProjects.length,
			totalFromHistory: historyResult.projects.length,
			parseTimeMs: Date.now() - start,
			error,
		};
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Unknown error";
		return {
			projects: [],
			totalFromSessions: sessionProjects.length,
			totalFromHistory: 0,
			parseTimeMs: Date.now() - start,
			error: `Failed to merge project discovery: ${msg}`,
		};
	}
}
