/**
 * User API routes
 * Provides user preferences, usage insights, and project recommendations
 */

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

export function registerUserRoutes(app: Express): void {
	// GET /api/user/insights - Usage patterns and recommendations
	app.get("/api/user/insights", async (_req: Request, res: Response) => {
		try {
			// Get all projects from history
			const historyProjects = await discoverProjectsFromHistory();

			// Sort by lastUsed for recent projects
			const recentProjects = [...historyProjects]
				.sort((a, b) => b.lastUsed - a.lastUsed)
				.slice(0, 5)
				.map((p) => ({
					path: p.path,
					name: p.path.split("/").pop() || p.path,
					lastUsed: p.lastUsed,
					source: "history" as const,
					exists: false, // existence check deferred for performance
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
					exists: false, // existence check deferred for performance
					interactionCount: p.interactionCount,
				}));

			// Compute usage stats
			const totalInteractions = historyProjects.reduce((sum, p) => sum + p.interactionCount, 0);

			const response: InsightsResponse = {
				recentProjects,
				mostUsedProjects,
				usageStats: {
					totalProjects: historyProjects.length,
					totalInteractions,
				},
			};

			res.json(response);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			res.status(500).json({
				error: `Failed to get user insights: ${message}`,
				recentProjects: [],
				mostUsedProjects: [],
				usageStats: {
					totalProjects: 0,
					totalInteractions: 0,
				},
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
