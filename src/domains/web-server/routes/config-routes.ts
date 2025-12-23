/**
 * Config API routes
 */

import { ConfigManager } from "@/domains/config/index.js";
import { logger } from "@/shared/logger.js";
import type { Express, Request, Response } from "express";
import type { ConfigResponse } from "../types.js";

export function registerConfigRoutes(app: Express): void {
	// GET /api/config - Get all configs (merged)
	app.get("/api/config", async (_req: Request, res: Response) => {
		try {
			const projectDir = process.cwd();

			// Load global config
			ConfigManager.setGlobalFlag(true);
			const globalConfig = await ConfigManager.load();

			// Load local config
			const localConfig = await ConfigManager.loadProjectConfig(projectDir, false);

			// Merge: local overrides global
			const merged = deepMerge(globalConfig, localConfig ? { paths: localConfig } : {});

			const response: ConfigResponse = {
				global: globalConfig,
				local: localConfig ? { paths: localConfig } : null,
				merged,
			};

			res.json(response);
		} catch (error) {
			logger.error(`Failed to load config: ${error}`);
			res.status(500).json({ error: "Failed to load configuration" });
		}
	});

	// GET /api/config/global
	app.get("/api/config/global", async (_req: Request, res: Response) => {
		try {
			ConfigManager.setGlobalFlag(true);
			const config = await ConfigManager.load();
			res.json(config);
		} catch (error) {
			res.status(500).json({ error: "Failed to load global config" });
		}
	});

	// GET /api/config/local
	app.get("/api/config/local", async (_req: Request, res: Response) => {
		try {
			const projectDir = process.cwd();
			const config = await ConfigManager.loadProjectConfig(projectDir, false);
			res.json(config ? { paths: config } : {});
		} catch (error) {
			res.status(500).json({ error: "Failed to load local config" });
		}
	});

	// POST /api/config - Update config
	app.post("/api/config", async (req: Request, res: Response) => {
		try {
			const { scope = "local", config } = req.body;

			if (!config || typeof config !== "object") {
				res.status(400).json({ error: "Invalid config payload" });
				return;
			}

			if (scope === "global") {
				ConfigManager.setGlobalFlag(true);
				await ConfigManager.save(config);
			} else {
				const projectDir = process.cwd();
				await ConfigManager.saveProjectConfig(projectDir, config.paths || config, false);
			}

			res.json({ success: true, scope });
		} catch (error) {
			logger.error(`Failed to save config: ${error}`);
			res.status(500).json({ error: "Failed to save configuration" });
		}
	});
}

function deepMerge(
	target: Record<string, unknown>,
	source: Record<string, unknown>,
): Record<string, unknown> {
	const result = { ...target };
	for (const key of Object.keys(source)) {
		const sourceVal = source[key];
		if (sourceVal && typeof sourceVal === "object" && !Array.isArray(sourceVal)) {
			result[key] = deepMerge(
				(result[key] as Record<string, unknown>) || {},
				sourceVal as Record<string, unknown>,
			);
		} else {
			result[key] = sourceVal;
		}
	}
	return result;
}
