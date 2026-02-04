/**
 * Scan ~/.claude/projects/ directory for Claude projects
 */

import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, normalize } from "node:path";

export interface ScannedProject {
	id: string;
	path: string;
	name: string;
	sessionCount: number;
	lastActivity: Date;
}

const projectsDir = join(homedir(), ".claude", "projects");

/**
 * Decode path-encoded directory name
 * Example: "-home-kai-project" -> "/home/kai/project"
 */
export function decodePath(encoded: string): string {
	// Replace leading dash with / and all other dashes with /
	// But handle double-dashes (escaped dashes) if any
	const decoded = encoded.replace(/^-/, "/").replace(/-/g, "/");
	const normalized = normalize(decoded);

	// Reject path traversal attempts
	if (normalized.includes("..")) {
		throw new Error(`Invalid path: contains traversal pattern - ${encoded}`);
	}

	return normalized;
}

/**
 * Encode a path to directory-safe name
 * Example: "/home/kai/project" -> "-home-kai-project"
 */
export function encodePath(path: string): string {
	return path.replace(/\//g, "-").replace(/^-/, "-");
}

export async function scanProjects(): Promise<ScannedProject[]> {
	if (!existsSync(projectsDir)) return [];

	try {
		const entries = await readdir(projectsDir);
		const projects: ScannedProject[] = [];

		for (const entry of entries) {
			const entryPath = join(projectsDir, entry);
			const entryStat = await stat(entryPath).catch(() => null);
			if (!entryStat?.isDirectory()) continue;

			// Count JSONL files
			const files = await readdir(entryPath).catch(() => []);
			const jsonlFiles = files.filter((f) => f.endsWith(".jsonl"));

			// Get last modified time
			let lastActivity = new Date(0);
			for (const file of jsonlFiles.slice(-5)) {
				// Check last 5 for perf
				const fileStat = await stat(join(entryPath, file)).catch(() => null);
				if (fileStat && fileStat.mtime > lastActivity) {
					lastActivity = fileStat.mtime;
				}
			}

			const decodedPath = decodePath(entry);
			projects.push({
				id: entry,
				path: decodedPath,
				name: basename(decodedPath),
				sessionCount: jsonlFiles.length,
				lastActivity,
			});
		}

		// Sort by last activity (most recent first)
		projects.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
		return projects;
	} catch {
		return [];
	}
}
