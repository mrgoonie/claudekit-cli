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

/** Content block types matching the frontend ContentBlock interface */
interface ContentBlock {
	type: "text" | "thinking" | "tool_use" | "tool_result" | "system";
	text?: string;
	toolName?: string;
	toolInput?: string;
	toolUseId?: string;
	result?: string;
	isError?: boolean;
}

/** Cap strings at 8KB to prevent oversized responses */
function capStr(s: string, limit = 8192): string {
	return s.length > limit ? `${s.slice(0, limit)}...` : s;
}

/**
 * Extract Claude Code system XML tags from text into system blocks.
 * Handles: <system-reminder>, <task-notification>, <local-command-*>, <command-*> (caveat/stdout)
 * Returns [systemBlocks[], remainingText with tags removed]
 */
function extractSystemTags(text: string): [ContentBlock[], string] {
	const sysBlocks: ContentBlock[] = [];
	// Pattern matches all known Claude Code system XML tags
	const tagPattern =
		/<(system-reminder|task-notification|local-command-stdout|local-command-caveat|antml:thinking)>([\s\S]*?)<\/\1>/g;
	const remaining = text.replace(tagPattern, (_match, tag: string, content: string) => {
		sysBlocks.push({ type: "system", text: `[${tag}]\n${content.trim()}` });
		return "";
	});
	return [sysBlocks, remaining.trim()];
}

/** Stringify tool input safely */
function stringifyInput(input: unknown): string | undefined {
	if (input === undefined || input === null) return undefined;
	try {
		const raw = typeof input === "string" ? input : JSON.stringify(input, null, 2);
		return capStr(raw);
	} catch {
		return capStr(String(input));
	}
}

/** Extract tool_result content string from various formats */
function extractResultContent(block: { content?: string | Array<{ type: string; text?: string }> }):
	| string
	| undefined {
	if (typeof block.content === "string") return capStr(block.content);
	if (Array.isArray(block.content)) {
		const textPart = block.content.find((c) => c.type === "text");
		if (textPart?.text) return capStr(textPart.text);
	}
	return undefined;
}

/**
 * Two-pass JSONL parser producing typed ContentBlock arrays per message.
 * Pass 1: Build tool results map by tool_use_id
 * Pass 2: Build messages with ordered content blocks
 */
async function parseSessionDetail(
	filePath: string,
	limit: number,
	offset: number,
): Promise<{
	messages: Array<{ role: string; timestamp?: string; contentBlocks: ContentBlock[] }>;
	summary: { messageCount: number; toolCallCount: number; duration?: string };
}> {
	// Guard: reject files >10 MB to prevent memory exhaustion on very large sessions
	const MAX_SESSION_FILE_BYTES = 50 * 1024 * 1024;
	const fileStats = await stat(filePath);
	if (fileStats.size > MAX_SESSION_FILE_BYTES) {
		return {
			messages: [
				{
					role: "system",
					contentBlocks: [
						{
							type: "text",
							text: `Session file too large (${(fileStats.size / 1024 / 1024).toFixed(1)} MB, limit 10 MB). Showing summary only.`,
						},
					],
				},
			],
			summary: { messageCount: 0, toolCallCount: 0 },
		};
	}

	const raw = await readFile(filePath, "utf-8");
	const lines = raw.split("\n").filter((l) => l.trim());

	// ── Pass 1: Collect tool results keyed by tool_use_id ──
	const toolResultsMap = new Map<string, { result: string; isError: boolean }>();
	for (const line of lines) {
		try {
			const event = JSON.parse(line) as {
				type?: string;
				message?: {
					content?: Array<{
						type: string;
						tool_use_id?: string;
						content?: string | Array<{ type: string; text?: string }>;
						is_error?: boolean;
					}>;
				};
			};
			if (!event.message?.content || !Array.isArray(event.message.content)) continue;
			for (const block of event.message.content) {
				if (block.type === "tool_result" && block.tool_use_id) {
					const result = extractResultContent(block);
					if (result) {
						toolResultsMap.set(block.tool_use_id, {
							result,
							isError: block.is_error === true,
						});
					}
				}
			}
		} catch {
			// Skip malformed
		}
	}

	// ── Pass 2: Build messages with typed ContentBlocks ──
	const messages: Array<{ role: string; timestamp?: string; contentBlocks: ContentBlock[] }> = [];
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
						| Array<{
								type: string;
								text?: string;
								thinking?: string;
								name?: string;
								input?: unknown;
								id?: string;
						  }>;
				};
			};

			if (event.timestamp) {
				const ts = new Date(event.timestamp).getTime();
				if (!Number.isNaN(ts)) {
					if (firstTimestamp === null) firstTimestamp = ts;
					lastTimestamp = ts;
				}
			}

			if (event.type !== "user" && event.type !== "assistant") continue;
			if (!event.message?.role) continue;

			const role = event.message.role;
			const rawContent = event.message.content;
			const blocks: ContentBlock[] = [];

			if (typeof rawContent === "string") {
				// Check for system-reminder tags in string content
				const [sysBlocks, remaining] = extractSystemTags(rawContent);
				blocks.push(...sysBlocks);
				if (remaining) blocks.push({ type: "text", text: remaining });
			} else if (Array.isArray(rawContent)) {
				for (const block of rawContent) {
					if (block.type === "text" && block.text) {
						// Extract system-reminders from text blocks
						const [sysBlocks, remaining] = extractSystemTags(block.text);
						blocks.push(...sysBlocks);
						if (remaining) blocks.push({ type: "text", text: remaining });
					} else if (block.type === "thinking" && block.thinking) {
						blocks.push({ type: "thinking", text: block.thinking });
					} else if (block.type === "tool_use" && block.name) {
						const toolBlock: ContentBlock = {
							type: "tool_use",
							toolName: block.name,
							toolInput: stringifyInput(block.input),
							toolUseId: block.id,
						};
						// Attach result from Pass 1 map
						if (block.id && toolResultsMap.has(block.id)) {
							const linked = toolResultsMap.get(block.id);
							if (linked) {
								toolBlock.result = linked.result;
								toolBlock.isError = linked.isError;
							}
						}
						blocks.push(toolBlock);
						toolCallCount++;
					}
					// tool_result blocks handled via map in Pass 1
				}
			}

			if (blocks.length > 0) {
				messages.push({ role, timestamp: event.timestamp, contentBlocks: blocks });
			}
		} catch {
			// Skip malformed
		}
	}

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
	return { messages: paged, summary: { messageCount: total, toolCallCount, duration } };
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

				// Use discovered-{base64url} format to match what GET /api/projects produces
				// and what SessionsPage navigates to via /project/${project.id}
				const encodedPath = Buffer.from(decodedPath).toString("base64url");
				projects.push({
					id: `discovered-${encodedPath}`,
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

		// Locate the session file — try direct filename match (e.g., <sessionId>.jsonl)
		const directPath = join(projectDir, `${sessionId}.jsonl`);
		const filePath: string | null = existsSync(directPath) ? directPath : null;

		if (!filePath) {
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
