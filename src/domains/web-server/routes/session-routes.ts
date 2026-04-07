/**
 * Session API routes
 *
 * Claude CLI stores sessions in ~/.claude/projects/{dash-encoded-path}/
 * where dash-encoded-path is the project path with / replaced by -
 * e.g., /home/kai/myproject → -home-kai-myproject
 */

import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { ProjectsRegistryManager } from "@/domains/claudekit-data/index.js";
import { getProjectSessions } from "@/services/claude-data/index.js";
import { encodePath } from "@/services/claude-data/project-scanner.js";
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

	let projectDirs: string[] = [];
	try {
		projectDirs = await readdir(projectsDir);
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

	const projectActivities: ProjectActivity[] = [];
	let totalSessions = 0;

	for (const dirName of projectDirs) {
		const dirPath = join(projectsDir, dirName);
		let files: string[] = [];
		try {
			const dirStat = await stat(dirPath);
			if (!dirStat.isDirectory()) continue;
			files = await readdir(dirPath);
		} catch {
			continue;
		}

		const sessionFiles = files.filter((f) => f.endsWith(".jsonl"));
		if (sessionFiles.length === 0) continue;

		let lastActive: string | null = null;
		let latestMtime = 0;

		for (const sessionFile of sessionFiles) {
			const filePath = join(dirPath, sessionFile);
			try {
				const fileStat = await stat(filePath);
				const mtime = fileStat.mtime;
				const mtimeMs = mtime.getTime();

				// Count this session in daily buckets if within cutoff
				if (mtime >= cutoff) {
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

		totalSessions += sessionFiles.length;
		projectActivities.push({
			name: dirName,
			path: dirPath,
			sessionCount: sessionFiles.length,
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

export function registerSessionRoutes(app: Express): void {
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
			const limitParam = Number(req.query.limit);
			const limit = !Number.isNaN(limitParam) && limitParam > 0 ? limitParam : 10;
			const sessions = await getProjectSessions(projectDir, limit);
			res.json(sessions);
		} catch (error) {
			res.status(500).json({ error: "Failed to list sessions" });
		}
	});
}
