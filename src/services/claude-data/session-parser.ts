/**
 * Parse JSONL session files from ~/.claude/projects/{project}/
 */

import { existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

export interface Session {
	id: string;
	timestamp: string;
	duration: string;
	summary: string;
}

interface SessionEvent {
	type: string;
	timestamp?: string;
	summary?: string;
	message?: {
		role: string;
		content: string | { type: string; text: string }[];
	};
	sessionId?: string;
}

/**
 * Format timestamp as "Today 14:32" or "Dec 21 18:20"
 */
function formatTimestamp(date: Date): string {
	const now = new Date();
	const isToday = date.toDateString() === now.toDateString();
	const hours = date.getHours().toString().padStart(2, "0");
	const minutes = date.getMinutes().toString().padStart(2, "0");

	if (isToday) {
		return `Today ${hours}:${minutes}`;
	}

	const months = [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec",
	];
	return `${months[date.getMonth()]} ${date.getDate()} ${hours}:${minutes}`;
}

/**
 * Format duration as "2h 15min"
 */
function formatDuration(startMs: number, endMs: number): string {
	const diffMs = endMs - startMs;
	const minutes = Math.floor(diffMs / 60000);
	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;

	if (hours === 0) {
		return `${remainingMinutes}min`;
	}
	return `${hours}h ${remainingMinutes}min`;
}

/**
 * Extract text content from message
 */
function extractContent(message: SessionEvent["message"]): string {
	if (!message?.content) return "";
	if (typeof message.content === "string") {
		return message.content;
	}
	// Content array - find first text block
	const textBlock = message.content.find((b) => b.type === "text");
	return textBlock?.text || "";
}

/**
 * Parse a single session file and extract session metadata
 */
export async function parseSession(filePath: string): Promise<Session | null> {
	try {
		const content = await readFile(filePath, "utf-8");
		const lines = content.split("\n").filter((l) => l.trim());
		if (lines.length === 0) return null;

		let summary = "";
		let sessionId = "";
		let firstTimestamp: Date | null = null;
		let lastTimestamp: Date | null = null;

		for (const line of lines) {
			try {
				const event = JSON.parse(line) as SessionEvent;

				// Get summary from first line if type is "summary"
				if (event.type === "summary" && event.summary && !summary) {
					summary = event.summary;
				}

				// Get session ID
				if (event.sessionId && !sessionId) {
					sessionId = event.sessionId;
				}

				// Track timestamps
				if (event.timestamp) {
					const ts = new Date(event.timestamp);
					if (!firstTimestamp) firstTimestamp = ts;
					lastTimestamp = ts;
				}

				// Fallback summary: first user message
				if (event.type === "user" && event.message?.role === "user" && !summary) {
					const text = extractContent(event.message);
					// Clean up and truncate
					summary = text.replace(/<[^>]+>/g, "").slice(0, 100);
					if (text.length > 100) summary += "...";
				}
			} catch {
				// Skip malformed lines
			}
		}

		if (!sessionId || !firstTimestamp) return null;

		return {
			id: sessionId,
			timestamp: formatTimestamp(firstTimestamp),
			duration: lastTimestamp
				? formatDuration(firstTimestamp.getTime(), lastTimestamp.getTime())
				: "0min",
			summary: summary || "No summary available",
		};
	} catch {
		return null;
	}
}

/**
 * Get all sessions for a project directory
 */
export async function getProjectSessions(projectDir: string, limit = 10): Promise<Session[]> {
	if (!existsSync(projectDir)) return [];

	try {
		const files = await readdir(projectDir);
		const jsonlFiles = files.filter((f) => f.endsWith(".jsonl"));

		// Get file stats for sorting by mtime
		const fileStats = await Promise.all(
			jsonlFiles.map(async (file) => {
				const filePath = join(projectDir, file);
				const fileStat = await stat(filePath).catch(() => null);
				return { file, filePath, mtime: fileStat?.mtime || new Date(0) };
			}),
		);

		// Sort by most recent first, take top N
		fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
		const recentFiles = fileStats.slice(0, limit);

		// Parse sessions in parallel
		const sessions = await Promise.all(recentFiles.map((f) => parseSession(f.filePath)));

		return sessions.filter((s): s is Session => s !== null);
	} catch {
		return [];
	}
}
