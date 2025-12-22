/**
 * Session Reader - Parses .jsonl session files from ~/.claude/projects/
 * Extracts session metadata including summary from first line
 */
import { existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import { encodeProjectSlug } from "./project-manager.js";

export interface SessionInfo {
	id: string;
	summary: string;
	timestamp: Date;
	duration?: number;
}

interface SessionEntry {
	type?: string;
	summary?: string;
	timestamp?: string;
	message?: string;
}

/**
 * Get recent sessions for a project
 * @param projectPath - Absolute path to the project
 * @param limit - Maximum number of sessions to return (default: 5)
 */
export async function getRecentSessions(projectPath: string, limit = 5): Promise<SessionInfo[]> {
	const projectDir = findProjectDir(projectPath);

	if (!projectDir) {
		return [];
	}

	try {
		const entries = await readdir(projectDir);
		const sessions: SessionInfo[] = [];

		for (const entry of entries) {
			if (!entry.endsWith(".jsonl")) continue;

			const filePath = join(projectDir, entry);
			const stats = await stat(filePath);
			const sessionInfo = await parseSessionFile(filePath, entry, stats.mtime);

			if (sessionInfo) {
				sessions.push(sessionInfo);
			}
		}

		// Sort by timestamp (most recent first) and limit
		return sessions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, limit);
	} catch (error) {
		logger.error(`Failed to get recent sessions: ${error}`);
		return [];
	}
}

/**
 * Parse a session .jsonl file
 * The first line with type:summary contains the session summary
 */
async function parseSessionFile(
	filePath: string,
	filename: string,
	mtime: Date,
): Promise<SessionInfo | null> {
	try {
		const content = await readFile(filePath, "utf-8");
		const lines = content.split("\n").filter(Boolean);

		if (lines.length === 0) {
			return null;
		}

		// Find summary in first few lines
		let summary = "";
		let firstTimestamp: Date | null = null;
		let lastTimestamp: Date | null = null;

		for (let i = 0; i < Math.min(lines.length, 10); i++) {
			try {
				const entry = JSON.parse(lines[i]) as SessionEntry;

				// Track timestamps for duration calculation
				if (entry.timestamp) {
					const ts = new Date(entry.timestamp);
					if (!firstTimestamp) firstTimestamp = ts;
					lastTimestamp = ts;
				}

				// Look for summary type
				if (entry.type === "summary" && entry.summary) {
					summary = entry.summary;
					break;
				}

				// Fallback: use first message as summary
				if (!summary && entry.message && typeof entry.message === "string") {
					summary = entry.message.substring(0, 100);
					if (entry.message.length > 100) summary += "...";
				}
			} catch {
				// Skip malformed lines
			}
		}

		// Also check last few lines for end timestamp
		for (let i = lines.length - 1; i >= Math.max(0, lines.length - 5); i--) {
			try {
				const entry = JSON.parse(lines[i]) as SessionEntry;
				if (entry.timestamp) {
					lastTimestamp = new Date(entry.timestamp);
					break;
				}
			} catch {
				// Skip malformed lines
			}
		}

		// Calculate duration if we have both timestamps
		let duration: number | undefined;
		if (firstTimestamp && lastTimestamp) {
			duration = Math.floor((lastTimestamp.getTime() - firstTimestamp.getTime()) / 1000);
		}

		return {
			id: filename.replace(".jsonl", ""),
			summary: summary || "No summary available",
			timestamp: mtime,
			duration,
		};
	} catch (error) {
		logger.debug(`Failed to parse session file ${filePath}: ${error}`);
		return null;
	}
}

/**
 * Find the Claude project directory for a given project path
 * @param projectPath - Absolute path to the project
 * @returns Path to the project's Claude session directory, or null if not found
 */
export function findProjectDir(projectPath: string): string | null {
	const projectsBase = join(PathResolver.getGlobalKitDir(), "projects");
	const slug = encodeProjectSlug(projectPath);
	const projectDir = join(projectsBase, slug);

	if (existsSync(projectDir)) {
		return projectDir;
	}

	return null;
}
