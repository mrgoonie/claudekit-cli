/**
 * Session API routes
 *
 * Claude CLI stores sessions in ~/.claude/projects/{dash-encoded-path}/
 * where dash-encoded-path is the project path with / replaced by -
 * e.g., /home/kai/myproject → -home-kai-myproject
 */

import { existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { ProjectsRegistryManager } from "@/domains/claudekit-data/index.js";
import { getProjectSessions } from "@/services/claude-data/index.js";
import { decodePath, encodePath } from "@/services/claude-data/project-scanner.js";
import type { Express, Request, Response } from "express";

/**
 * Activity data for a single project directory under ~/.claude/projects/
 */
interface ProjectActivity {
	name: string;
	path: string;
	sessionCount: number;
	lastActive: string | null;
}

/**
 * Response shape for GET /api/sessions/activity
 */
interface ActivityResponse {
	totalSessions: number;
	projects: ProjectActivity[];
	dailyCounts: Array<{ date: string; count: number }>;
}

/**
 * Format a Date as YYYY-MM-DD string in local time.
 */
function toDateStr(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

/**
 * Scan ~/.claude/projects/ and aggregate activity metrics.
 * Each sub-directory is a project; each .jsonl file inside is a session.
 */
async function scanActivityMetrics(periodDays: number): Promise<ActivityResponse> {
	const home = homedir();
	const projectsDir = join(home, ".claude", "projects");

	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - periodDays);

	// Initialise daily count buckets for every day in the period
	const dailyMap = new Map<string, number>();
	for (let i = 0; i < periodDays; i++) {
		const d = new Date();
		d.setDate(d.getDate() - i);
		dailyMap.set(toDateStr(d), 0);
	}

	const projectActivities: ProjectActivity[] = [];
	let totalSessions = 0;

	// Use withFileTypes to avoid N extra stat() syscalls
	let projectEntries: import("node:fs").Dirent[] = [];
	try {
		projectEntries = await readdir(projectsDir, { withFileTypes: true });
	} catch {
		// Directory may not exist yet — return empty metrics
		return {
			totalSessions: 0,
			projects: [],
			dailyCounts: Array.from(dailyMap.entries())
				.map(([date, count]) => ({ date, count }))
				.sort((a, b) => a.date.localeCompare(b.date)),
		};
	}

	for (const dirEntry of projectEntries) {
		if (!dirEntry.isDirectory()) continue;
		const dirName = dirEntry.name;
		const dirPath = join(projectsDir, dirName);
		let files: string[] = [];
		try {
			files = await readdir(dirPath);
		} catch {
			continue;
		}

		const sessionFiles = files.filter((f) => f.endsWith(".jsonl"));
		if (sessionFiles.length === 0) continue;

		let lastActive: string | null = null;
		let latestMtime = 0;
		let periodCount = 0;

		for (const sessionFile of sessionFiles) {
			const filePath = join(dirPath, sessionFile);
			try {
				const fileStat = await stat(filePath);
				const mtime = fileStat.mtime;
				const mtimeMs = mtime.getTime();

				// Count this session in daily buckets if within cutoff
				if (mtime >= cutoff) {
					periodCount++;
					const dateKey = toDateStr(mtime);
					dailyMap.set(dateKey, (dailyMap.get(dateKey) ?? 0) + 1);
				}

				if (mtimeMs > latestMtime) {
					latestMtime = mtimeMs;
					lastActive = mtime.toISOString();
				}
			} catch {
				// Skip unreadable files
			}
		}

		// Skip projects with no activity in the selected period
		if (periodCount === 0) continue;

		totalSessions += periodCount;
		projectActivities.push({
			name: dirName,
			path: dirPath,
			sessionCount: periodCount,
			lastActive,
		});
	}

	// Sort by session count descending
	projectActivities.sort((a, b) => b.sessionCount - a.sessionCount);

	const dailyCounts = Array.from(dailyMap.entries())
		.map(([date, count]) => ({ date, count }))
		.sort((a, b) => a.date.localeCompare(b.date));

	return { totalSessions, projects: projectActivities, dailyCounts };
}

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

/** Parse a JSONL session file and return structured messages + summary */
async function parseSessionDetail(
	filePath: string,
	limit: number,
	offset: number,
): Promise<{
	messages: Array<{
		role: string;
		content: string;
		timestamp?: string;
		toolCalls?: Array<{ name: string; result?: string }>;
	}>;
	summary: { messageCount: number; toolCallCount: number; duration?: string };
}> {
	const raw = await readFile(filePath, "utf-8");
	const lines = raw.split("\n").filter((l) => l.trim());

	const messages: Array<{
		role: string;
		content: string;
		timestamp?: string;
		toolCalls?: Array<{ name: string; result?: string }>;
	}> = [];

	let firstTimestamp: number | null = null;
	let lastTimestamp: number | null = null;
	let toolCallCount = 0;

	for (const line of lines) {
		try {
			const event = JSON.parse(line) as {
				type?: string;
				timestamp?: string;
				message?: {
					role?: string;
					content?:
						| string
						| Array<{ type: string; text?: string; name?: string; input?: unknown; id?: string }>;
				};
			};

			if (event.timestamp) {
				const ts = new Date(event.timestamp).getTime();
				if (!Number.isNaN(ts)) {
					if (firstTimestamp === null) firstTimestamp = ts;
					lastTimestamp = ts;
				}
			}

			// Only process user/assistant message events
			if (event.type !== "user" && event.type !== "assistant") continue;
			if (!event.message?.role) continue;

			const role = event.message.role;
			const rawContent = event.message.content;

			// Extract text content
			let text = "";
			const toolCalls: Array<{ name: string; result?: string }> = [];

			if (typeof rawContent === "string") {
				text = rawContent;
			} else if (Array.isArray(rawContent)) {
				for (const block of rawContent) {
					if (block.type === "text" && block.text) {
						text += (text ? "\n" : "") + block.text;
					} else if (block.type === "tool_use" && block.name) {
						toolCalls.push({ name: block.name });
						toolCallCount++;
					} else if (block.type === "tool_result") {
						// Attach result to last tool_use if present
						const last = toolCalls[toolCalls.length - 1];
						if (last && !last.result) {
							const resultContent = (
								block as { type: string; content?: string | Array<{ type: string; text?: string }> }
							).content;
							if (typeof resultContent === "string") {
								last.result = resultContent.slice(0, 200);
							} else if (Array.isArray(resultContent)) {
								const textPart = resultContent.find((c) => c.type === "text");
								if (textPart?.text) last.result = textPart.text.slice(0, 200);
							}
						}
					}
				}
			}

			messages.push({
				role,
				content: text,
				timestamp: event.timestamp,
				toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
			});
		} catch {
			// Skip malformed lines
		}
	}

	// Compute duration
	let duration: string | undefined;
	if (firstTimestamp !== null && lastTimestamp !== null && lastTimestamp > firstTimestamp) {
		const diffMs = lastTimestamp - firstTimestamp;
		const minutes = Math.floor(diffMs / 60000);
		const hours = Math.floor(minutes / 60);
		const remaining = minutes % 60;
		duration = hours > 0 ? `${hours}h ${remaining}min` : `${minutes}min`;
	}

	const total = messages.length;
	const paged = messages.slice(offset, offset + limit);

	return {
		messages: paged,
		summary: { messageCount: total, toolCallCount, duration },
	};
}

export function registerSessionRoutes(app: Express): void {
	// GET /api/sessions — List all projects with session metadata
	app.get("/api/sessions", async (_req: Request, res: Response) => {
		const home = homedir();
		const projectsDir = join(home, ".claude", "projects");

		if (!existsSync(projectsDir)) {
			res.json({ projects: [] });
			return;
		}

		try {
			const entries = await readdir(projectsDir);
			const projects: Array<{
				id: string;
				name: string;
				path: string;
				sessionCount: number;
				lastActive: string;
			}> = [];

			for (const entry of entries) {
				const entryPath = join(projectsDir, entry);
				const entryStat = await stat(entryPath).catch(() => null);
				if (!entryStat?.isDirectory()) continue;

				const files = await readdir(entryPath).catch(() => [] as string[]);
				const jsonlFiles = files.filter((f) => f.endsWith(".jsonl"));
				if (jsonlFiles.length === 0) continue;

				let lastActive = new Date(0);
				// Check last 5 files for perf
				for (const file of jsonlFiles.slice(-5)) {
					const fileStat = await stat(join(entryPath, file)).catch(() => null);
					if (fileStat && fileStat.mtime > lastActive) {
						lastActive = fileStat.mtime;
					}
				}

				let decodedPath: string;
				try {
					decodedPath = decodePath(entry);
				} catch {
					decodedPath = entry;
				}

				projects.push({
					id: entry,
					name: basename(decodedPath),
					path: decodedPath,
					sessionCount: jsonlFiles.length,
					lastActive: lastActive.toISOString(),
				});
			}

			projects.sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime());
			res.json({ projects });
		} catch {
			res.status(500).json({ error: "Failed to list projects" });
		}
	});

	// GET /api/sessions/activity - Aggregate activity metrics across all projects
	// Must be registered before /:projectId to avoid "activity" being treated as a param
	app.get("/api/sessions/activity", async (req: Request, res: Response) => {
		const rawPeriod = typeof req.query.period === "string" ? req.query.period : "7d";
		const periodMap: Record<string, number> = { "24h": 1, "7d": 7, "30d": 30 };
		const periodDays = periodMap[rawPeriod] ?? 7;

		try {
			const data = await scanActivityMetrics(periodDays);
			res.json(data);
		} catch {
			res.status(500).json({ error: "Failed to scan activity metrics" });
		}
	});

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

		try {
			const limitParam = Number(String(req.query.limit));
			const limit = !Number.isNaN(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 10;
			const sessions = await getProjectSessions(projectDir, limit);
			res.json(sessions);
		} catch (error) {
			res.status(500).json({ error: "Failed to list sessions" });
		}
	});

	// GET /api/sessions/:projectId/:sessionId — Session detail (paginated)
	app.get("/api/sessions/:projectId/:sessionId", async (req: Request, res: Response) => {
		const projectId = String(req.params.projectId);
		const sessionId = String(req.params.sessionId);

		// Security: block path traversal in both params
		if (
			decodeURIComponent(projectId).includes("..") ||
			decodeURIComponent(sessionId).includes("..")
		) {
			res.status(400).json({ error: "Invalid parameters" });
			return;
		}

		// sessionId must be a safe filename (no slashes or traversal)
		if (/[/\\]/.test(sessionId)) {
			res.status(400).json({ error: "Invalid session ID" });
			return;
		}

		const projectDir = await resolveSessionDir(decodeURIComponent(projectId));
		if (!projectDir) {
			res.status(404).json({ error: "Project not found" });
			return;
		}

		const allowedBase = join(homedir(), ".claude", "projects");
		if (!projectDir.startsWith(allowedBase)) {
			res.status(403).json({ error: "Access denied" });
			return;
		}

		// Locate the session file — sessionId can be a UUID (filename) or a session UUID embedded in JSONL
		// First: try direct filename match (e.g., <sessionId>.jsonl)
		const directPath = join(projectDir, `${sessionId}.jsonl`);

		// Second: scan files to find one containing matching sessionId
		let filePath: string | null = null;
		if (existsSync(directPath)) {
			filePath = directPath;
		} else {
			const files = await readdir(projectDir).catch(() => [] as string[]);
			const jsonlFiles = files.filter((f) => f.endsWith(".jsonl"));
			for (const file of jsonlFiles) {
				if (file.replace(".jsonl", "") === sessionId) {
					filePath = join(projectDir, file);
					break;
				}
			}
		}

		if (!filePath || !existsSync(filePath)) {
			res.status(404).json({ error: "Session not found" });
			return;
		}

		// Validate resolved path stays within project dir
		if (!filePath.startsWith(projectDir)) {
			res.status(403).json({ error: "Access denied" });
			return;
		}

		try {
			const limitParam = Number(String(req.query.limit));
			const offsetParam = Number(String(req.query.offset));
			const limit = !Number.isNaN(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50;
			const offset = !Number.isNaN(offsetParam) && offsetParam >= 0 ? offsetParam : 0;

			const result = await parseSessionDetail(filePath, limit, offset);
			res.json(result);
		} catch {
			res.status(500).json({ error: "Failed to parse session" });
		}
	});
}
