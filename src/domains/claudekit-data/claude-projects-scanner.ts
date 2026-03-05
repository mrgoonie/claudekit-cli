/**
 * Claude Projects Scanner
 * Discovers projects from Claude Code's ~/.claude/projects/ directory
 *
 * Claude Code tracks projects by creating directories with encoded names.
 * Each directory contains .jsonl session files with a "cwd" field
 * containing the actual project path.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { logger } from "@/shared/logger.js";

export interface DiscoveredProject {
	path: string;
	lastModified: Date;
}

/**
 * Extract the actual project path from a Claude project directory
 * by reading the "cwd" field from one of the .jsonl session files.
 */
function extractProjectPath(claudeProjectDir: string): string | null {
	try {
		const files = readdirSync(claudeProjectDir);
		const jsonlFile = files.find((f) => f.endsWith(".jsonl"));

		if (!jsonlFile) return null;

		const filePath = join(claudeProjectDir, jsonlFile);
		const content = readFileSync(filePath, "utf-8");

		// Read first few lines to find one with cwd
		const lines = content.split("\n").slice(0, 10);
		for (const line of lines) {
			if (!line.trim()) continue;
			try {
				const data = JSON.parse(line);
				if (data.cwd && typeof data.cwd === "string") {
					return data.cwd;
				}
			} catch {
				// Skip malformed lines
			}
		}
		return null;
	} catch {
		return null;
	}
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
	const seenPaths = new Set<string>();

	try {
		const entries = readdirSync(claudeProjectsDir, { withFileTypes: true });

		for (const entry of entries) {
			if (!entry.isDirectory()) continue;

			const projectDirPath = join(claudeProjectsDir, entry.name);
			const projectPath = extractProjectPath(projectDirPath);

			if (!projectPath) {
				logger.debug(`Could not extract path from: ${entry.name}`);
				continue;
			}

			// Skip duplicates (same path from different encoded dirs)
			if (seenPaths.has(projectPath)) continue;
			seenPaths.add(projectPath);

			// Skip if path doesn't exist anymore
			if (!existsSync(projectPath)) {
				logger.debug(`Skipping stale project: ${projectPath}`);
				continue;
			}

			// Skip if it's a file, not a directory
			try {
				const pathStat = statSync(projectPath);
				if (!pathStat.isDirectory()) continue;
			} catch {
				continue;
			}

			// Get last modified time from the Claude project directory
			const dirStat = statSync(projectDirPath);

			discovered.push({
				path: projectPath,
				lastModified: dirStat.mtime,
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
 * Note: This scans all projects since encoding is ambiguous
 */
export function isClaudeProject(projectPath: string): boolean {
	const projects = scanClaudeProjects();
	return projects.some((p) => p.path === projectPath);
}
