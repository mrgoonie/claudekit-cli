/**
 * Session API routes
 *
 * Claude CLI stores sessions in ~/.claude/projects/{dash-encoded-path}/
 * where dash-encoded-path is the project path with / replaced by -
 * e.g., /home/kai/myproject -> -home-kai-myproject
 */

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { ProjectsRegistryManager } from "@/domains/claudekit-data/index.js";
import { getProjectSessions } from "@/services/claude-data/index.js";
import { encodePath } from "@/services/claude-data/project-scanner.js";
import type { Express, Request, Response } from "express";

/**
 * Convert project ID to Claude's dash-encoded session directory path.
 * Handles: discovered-{base64url}, registry UUIDs, and legacy IDs (current/global)
 */
async function resolveSessionDir(projectId: string): Promise<string | null> {
	const home = homedir();

	// Handle discovered projects: discovered-{base64url encoded path}
	if (projectId.startsWith("discovered-")) {
		try {
			const encodedPathB64 = projectId.slice("discovered-".length);
			const projectPath = Buffer.from(encodedPathB64, "base64url").toString("utf-8");
			// Claude encodes paths by replacing / with -
			const claudeEncoded = encodePath(projectPath);
			return join(home, ".claude", "projects", claudeEncoded);
		} catch {
			return null;
		}
	}

	// Handle legacy IDs
	if (projectId === "current") {
		const cwdEncoded = encodePath(process.cwd());
		return join(home, ".claude", "projects", cwdEncoded);
	}
	if (projectId === "global") {
		const globalEncoded = encodePath(join(home, ".claude"));
		return join(home, ".claude", "projects", globalEncoded);
	}

	// Handle registry projects: look up by ID to get path
	const registered = await ProjectsRegistryManager.getProject(projectId);
	if (registered) {
		const claudeEncoded = encodePath(registered.path);
		return join(home, ".claude", "projects", claudeEncoded);
	}

	return null;
}

interface DetailedSession {
	id: string;
	timestamp: string;
	duration: string;
	summary: string;
	messageCount: number;
	toolsUsed: string[];
	filesModified: string[];
	tokenEstimate: number;
}

interface JsonlEvent {
	type?: string;
	timestamp?: string;
	message?: {
		role?: string;
		content?: string | Array<{ type: string; name?: string; input?: Record<string, unknown> }>;
	};
	sessionId?: string;
	summary?: string;
}

/**
 * Extract detailed info from a session JSONL file
 */
async function parseDetailedSession(filePath: string): Promise<DetailedSession | null> {
	try {
		const content = await readFile(filePath, "utf-8");
		const lines = content.split("\n").filter((l) => l.trim());
		if (lines.length === 0) return null;

		let sessionId = "";
		let summary = "";
		let firstTimestamp: Date | null = null;
		let lastTimestamp: Date | null = null;
		let messageCount = 0;
		const toolsSet = new Set<string>();
		const filesSet = new Set<string>();

		for (const line of lines) {
			try {
				const event = JSON.parse(line) as JsonlEvent;

				if (event.sessionId && !sessionId) sessionId = event.sessionId;
				if (event.type === "summary" && event.summary && !summary) {
					summary = event.summary;
				}

				if (event.timestamp) {
					const ts = new Date(event.timestamp);
					if (!firstTimestamp) firstTimestamp = ts;
					lastTimestamp = ts;
				}

				if (event.message?.role === "user" || event.message?.role === "assistant") {
					messageCount++;
				}

				// Extract tool use from assistant messages
				if (event.message?.role === "assistant" && Array.isArray(event.message.content)) {
					for (const block of event.message.content) {
						if (block.type === "tool_use" && block.name) {
							toolsSet.add(block.name);
							// Track files from Edit/Write tool calls
							if (
								(block.name === "Edit" || block.name === "Write") &&
								block.input &&
								typeof block.input.file_path === "string"
							) {
								filesSet.add(block.input.file_path);
							}
						}
					}
				}

				// Fallback summary from first user message
				if (event.type === "user" && event.message?.role === "user" && !summary) {
					const text = typeof event.message.content === "string" ? event.message.content : "";
					summary = text.replace(/<[^>]+>/g, "").slice(0, 100);
					if (text.length > 100) summary += "...";
				}
			} catch {
				// Skip malformed lines
			}
		}

		if (!sessionId || !firstTimestamp) return null;

		const durationMs = lastTimestamp ? lastTimestamp.getTime() - firstTimestamp.getTime() : 0;
		const minutes = Math.floor(durationMs / 60000);
		const hours = Math.floor(minutes / 60);
		const remainingMinutes = minutes % 60;
		const duration = hours > 0 ? `${hours}h ${remainingMinutes}min` : `${remainingMinutes}min`;

		return {
			id: sessionId,
			timestamp: formatTimestamp(firstTimestamp),
			duration,
			summary: summary || "No summary available",
			messageCount,
			toolsUsed: Array.from(toolsSet),
			filesModified: Array.from(filesSet),
			tokenEstimate: messageCount * 500,
		};
	} catch {
		return null;
	}
}

function formatTimestamp(date: Date): string {
	const now = new Date();
	const isToday = date.toDateString() === now.toDateString();
	const hours = date.getHours().toString().padStart(2, "0");
	const minutes = date.getMinutes().toString().padStart(2, "0");
	if (isToday) return `Today ${hours}:${minutes}`;
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

export function registerSessionRoutes(app: Express): void {
	// GET /api/sessions/:projectId - List sessions for a project
	app.get("/api/sessions/:projectId", async (req: Request, res: Response) => {
		const projectId = String(req.params.projectId);
		const decodedId = decodeURIComponent(projectId);

		// Block path traversal in raw ID
		if (decodedId.includes("..")) {
			res.status(400).json({ error: "Invalid project ID" });
			return;
		}

		const projectDir = await resolveSessionDir(decodedId);
		if (!projectDir) {
			res.status(404).json({ error: "Project not found" });
			return;
		}

		// Verify resolved path is within allowed directory
		const allowedBase = join(homedir(), ".claude", "projects");
		if (!projectDir.startsWith(allowedBase)) {
			res.status(403).json({ error: "Access denied" });
			return;
		}

		const detailed = String(req.query.detailed) === "true";
		const limitParam = Number(req.query.limit);
		const limit = !Number.isNaN(limitParam) && limitParam > 0 ? limitParam : 10;

		try {
			if (detailed) {
				const { readdir, stat } = await import("node:fs/promises");
				const { existsSync } = await import("node:fs");
				if (!existsSync(projectDir)) {
					res.json([]);
					return;
				}

				const files = await readdir(projectDir);
				const jsonlFiles = files.filter((f) => f.endsWith(".jsonl"));

				const fileStats = await Promise.all(
					jsonlFiles.map(async (file) => {
						const filePath = join(projectDir, file);
						const fileStat = await stat(filePath).catch(() => null);
						return { filePath, mtime: fileStat?.mtime || new Date(0) };
					}),
				);

				fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
				const recentFiles = fileStats.slice(0, limit);

				const sessions = await Promise.all(
					recentFiles.map((f) => parseDetailedSession(f.filePath)),
				);
				res.json(sessions.filter((s): s is DetailedSession => s !== null));
			} else {
				const sessions = await getProjectSessions(projectDir, limit);
				res.json(sessions);
			}
		} catch {
			res.status(500).json({ error: "Failed to list sessions" });
		}
	});
}
