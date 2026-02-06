/**
 * User API routes
 * Provides user preferences, usage insights, activity heatmap, and project recommendations
 */

import { existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { discoverProjectsFromHistory } from "@/services/claude-data/index.js";
import type { DiscoveredProject } from "@/services/claude-data/types.js";
import {
	getEffectiveTheme,
	getUsageSummary,
	readUserPreferences,
} from "@/services/claude-data/user-preferences.js";
import type { Express, Request, Response } from "express";

/**
 * GET /api/user/insights
 * Returns usage patterns and project recommendations
 */
interface InsightsResponse {
	recentProjects: DiscoveredProject[]; // top 5 by lastUsed
	mostUsedProjects: DiscoveredProject[]; // top 5 by interactionCount
	usageStats: {
		totalProjects: number;
		totalInteractions: number;
	};
	dailySessions: Array<{ date: string; count: number }>;
	averageSessionDuration: number;
	peakHours: Array<{ hour: number; count: number }>;
	error?: string;
}

/**
 * GET /api/user/preferences
 * Returns user preferences and usage stats
 */
interface PreferencesResponse {
	theme: string;
	usage: {
		numStartups: number;
		firstStartTime: string | null;
		promptQueueUseCount: number;
		tipsShown: number;
	};
	featureFlags: Record<string, boolean>;
	error?: string;
}

interface CacheEntry<T> {
	data: T;
	expiry: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
	const entry = cache.get(key) as CacheEntry<T> | undefined;
	if (entry && Date.now() < entry.expiry) return entry.data;
	cache.delete(key);
	return null;
}

function setCache<T>(key: string, data: T): void {
	cache.set(key, { data, expiry: Date.now() + CACHE_TTL_MS });
}

/**
 * Scan all session files and extract timestamps for aggregation.
 * Only reads first and last lines per file for performance.
 */
async function scanSessionTimestamps(): Promise<Date[]> {
	const cached = getCached<Date[]>("session-timestamps");
	if (cached) return cached;

	const projectsDir = join(homedir(), ".claude", "projects");
	if (!existsSync(projectsDir)) return [];

	const timestamps: Date[] = [];

	try {
		const projectDirs = await readdir(projectsDir);

		for (const dir of projectDirs) {
			const dirPath = join(projectsDir, dir);
			const dirStat = await stat(dirPath).catch(() => null);
			if (!dirStat?.isDirectory()) continue;

			const files = await readdir(dirPath).catch(() => []);
			const jsonlFiles = files.filter((f) => f.endsWith(".jsonl"));

			for (const file of jsonlFiles) {
				const filePath = join(dirPath, file);
				try {
					const content = await readFile(filePath, "utf-8");
					const firstNewline = content.indexOf("\n");
					const firstLine = firstNewline > 0 ? content.slice(0, firstNewline) : content;

					if (firstLine.trim()) {
						const parsed = JSON.parse(firstLine);
						if (parsed.timestamp) {
							timestamps.push(new Date(parsed.timestamp));
						}
					}
				} catch {
					// Skip unreadable files
				}
			}
		}
	} catch {
		// Projects dir unreadable
	}

	setCache("session-timestamps", timestamps);
	return timestamps;
}

/**
 * Build daily session counts for last N days
 */
function buildDailySessions(
	timestamps: Date[],
	days: number,
): Array<{ date: string; count: number }> {
	const now = new Date();
	const cutoff = new Date(now);
	cutoff.setDate(cutoff.getDate() - days);

	const countMap = new Map<string, number>();

	// Pre-fill all days
	for (let i = 0; i < days; i++) {
		const d = new Date(now);
		d.setDate(d.getDate() - i);
		countMap.set(d.toISOString().slice(0, 10), 0);
	}

	for (const ts of timestamps) {
		if (ts < cutoff) continue;
		const key = ts.toISOString().slice(0, 10);
		if (countMap.has(key)) {
			countMap.set(key, (countMap.get(key) ?? 0) + 1);
		}
	}

	return Array.from(countMap.entries())
		.map(([date, count]) => ({ date, count }))
		.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Build peak hours distribution (24h)
 */
function buildPeakHours(timestamps: Date[]): Array<{ hour: number; count: number }> {
	const hourCounts = new Array(24).fill(0) as number[];
	for (const ts of timestamps) {
		hourCounts[ts.getHours()]++;
	}
	return hourCounts.map((count, hour) => ({ hour, count }));
}

export function registerUserRoutes(app: Express): void {
	// GET /api/user/insights - Usage patterns and recommendations
	app.get("/api/user/insights", async (_req: Request, res: Response) => {
		try {
			const [historyProjects, timestamps] = await Promise.all([
				discoverProjectsFromHistory(),
				scanSessionTimestamps(),
			]);

			// Sort by lastUsed for recent projects
			const recentProjects = [...historyProjects]
				.sort((a, b) => b.lastUsed - a.lastUsed)
				.slice(0, 5)
				.map((p) => ({
					path: p.path,
					name: p.path.split("/").pop() || p.path,
					lastUsed: p.lastUsed,
					source: "history" as const,
					exists: false,
					interactionCount: p.interactionCount,
				}));

			// Sort by interactionCount for most used
			const mostUsedProjects = [...historyProjects]
				.sort((a, b) => b.interactionCount - a.interactionCount)
				.slice(0, 5)
				.map((p) => ({
					path: p.path,
					name: p.path.split("/").pop() || p.path,
					lastUsed: p.lastUsed,
					source: "history" as const,
					exists: false,
					interactionCount: p.interactionCount,
				}));

			// Compute usage stats
			const totalInteractions = historyProjects.reduce((sum, p) => sum + p.interactionCount, 0);

			// Compute daily sessions (last 30 days)
			const dailySessions = buildDailySessions(timestamps, 30);

			// Estimate average session duration (rough: assume 15 min avg)
			const averageSessionDuration = timestamps.length > 0 ? 15 : 0;

			// Peak hours
			const peakHours = buildPeakHours(timestamps);

			const response: InsightsResponse = {
				recentProjects,
				mostUsedProjects,
				usageStats: {
					totalProjects: historyProjects.length,
					totalInteractions,
				},
				dailySessions,
				averageSessionDuration,
				peakHours,
			};

			res.json(response);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			res.status(500).json({
				error: `Failed to get user insights: ${message}`,
				recentProjects: [],
				mostUsedProjects: [],
				usageStats: { totalProjects: 0, totalInteractions: 0 },
				dailySessions: [],
				averageSessionDuration: 0,
				peakHours: [],
			});
		}
	});

	// GET /api/user/activity-heatmap - Session count per day (last 90 days)
	app.get("/api/user/activity-heatmap", async (_req: Request, res: Response) => {
		try {
			const timestamps = await scanSessionTimestamps();
			const heatmap = buildDailySessions(timestamps, 90);
			res.json(heatmap);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			res.status(500).json({
				error: `Failed to get activity heatmap: ${message}`,
			});
		}
	});

	// GET /api/user/preferences - User preferences and usage summary
	app.get("/api/user/preferences", async (_req: Request, res: Response) => {
		try {
			const prefs = await readUserPreferences();
			const theme = getEffectiveTheme(prefs);
			const usage = getUsageSummary(prefs);

			const response: PreferencesResponse = {
				theme,
				usage: {
					numStartups: usage.totalSessions,
					firstStartTime: usage.firstUsed?.toISOString() ?? null,
					promptQueueUseCount: usage.promptQueueUsage,
					tipsShown: usage.tipsShown,
				},
				featureFlags: prefs.featureFlags.statsigGates ?? {},
				error: prefs.error,
			};

			res.json(response);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			res.status(500).json({
				error: `Failed to get user preferences: ${message}`,
				theme: "system",
				usage: {
					numStartups: 0,
					firstStartTime: null,
					promptQueueUseCount: 0,
					tipsShown: 0,
				},
				featureFlags: {},
			});
		}
	});
}
