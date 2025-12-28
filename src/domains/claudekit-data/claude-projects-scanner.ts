/**
 * Claude Projects Scanner
 * Discovers projects from Claude Code's ~/.claude/projects/ directory
 *
 * Claude Code tracks projects by creating directories named with the
 * project path (/ replaced by -). This scanner decodes those names
 * to discover projects the user has worked with.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { logger } from "@/shared/logger.js";

export interface DiscoveredProject {
	path: string;
	lastModified: Date;
}

/**
 * Decode Claude's directory name format back to absolute path
 * e.g., "-home-kai-claudekit" → "/home/kai/claudekit"
 */
function decodeProjectPath(dirName: string): string {
	// Replace leading - with / and all other - with /
	// Handle edge case: Windows paths would start with drive letter
	if (dirName.startsWith("-")) {
		return dirName.replace(/^-/, "/").replace(/-/g, "/");
	}
	// Windows: C-Users-... → C:/Users/...
	return dirName.replace(/-/, ":/").replace(/-/g, "/");
}

/**
 * Scan ~/.claude/projects/ for discovered projects
 * Returns projects that still exist on disk
 */
export function scanClaudeProjects(): DiscoveredProject[] {
	const claudeProjectsDir = join(homedir(), ".claude", "projects");

	if (!existsSync(claudeProjectsDir)) {
		logger.debug("Claude projects directory not found");
		return [];
	}

	const discovered: DiscoveredProject[] = [];

	try {
		const entries = readdirSync(claudeProjectsDir, { withFileTypes: true });

		for (const entry of entries) {
			if (!entry.isDirectory()) continue;

			const decodedPath = decodeProjectPath(entry.name);

			// Skip if path doesn't exist anymore
			if (!existsSync(decodedPath)) {
				logger.debug(`Skipping stale project: ${decodedPath}`);
				continue;
			}

			// Skip if it's a file, not a directory
			try {
				const stat = statSync(decodedPath);
				if (!stat.isDirectory()) continue;
			} catch {
				continue;
			}

			// Get last modified time from the Claude project directory
			const projectDirPath = join(claudeProjectsDir, entry.name);
			const stat = statSync(projectDirPath);

			discovered.push({
				path: decodedPath,
				lastModified: stat.mtime,
			});
		}

		// Sort by last modified (most recent first)
		discovered.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

		logger.debug(`Discovered ${discovered.length} projects from Claude CLI`);
		return discovered;
	} catch (error) {
		logger.warning(
			`Failed to scan Claude projects: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
		return [];
	}
}

/**
 * Check if a path has been used with Claude Code
 */
export function isClaudeProject(projectPath: string): boolean {
	const claudeProjectsDir = join(homedir(), ".claude", "projects");
	const encodedName = projectPath.replace(/^\//, "-").replace(/\//g, "-");
	return existsSync(join(claudeProjectsDir, encodedName));
}
