/**
 * Settings API routes
 */

import {
	countHooks,
	countMcpServers,
	getCurrentModel,
	readSettings,
} from "@/services/claude-data/index.js";
import type { Express, Request, Response } from "express";

export function registerSettingsRoutes(app: Express): void {
	// GET /api/settings - Read Claude settings
	app.get("/api/settings", async (_req: Request, res: Response) => {
		try {
			const settings = await readSettings();

			// Model priority: env var > settings.json > default
			const model = getCurrentModel() || settings?.model || "claude-sonnet-4";
			const hookCount = settings ? countHooks(settings) : 0;
			const mcpServerCount = settings ? countMcpServers(settings) : 0;

			res.json({
				model,
				hookCount,
				mcpServerCount,
				permissions: settings?.permissions || null,
			});
		} catch (error) {
			res.status(500).json({ error: "Failed to read settings" });
		}
	});
}
