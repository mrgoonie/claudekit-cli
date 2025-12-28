/**
 * Config API routes
 *
 * Handles two types of config:
 * - Engineer Kit config: ~/.claude/.ck.json (codingLevel, plan, paths, etc.)
 * - ClaudeKit CLI config: ~/.claudekit/config.json (defaults, folders) - NOT used here
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ConfigManager } from "@/domains/config/index.js";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import type { Express, Request, Response } from "express";
import type { ConfigResponse } from "../types.js";

/** Path to global engineer kit config: ~/.claude/.ck.json */
const getEngineerKitConfigPath = () => join(PathResolver.getGlobalKitDir(), ".ck.json");

export function registerConfigRoutes(app: Express): void {
	// GET /api/config - Get all configs (merged)
	app.get("/api/config", async (_req: Request, res: Response) => {
		try {
			const projectDir = process.cwd();
			const globalConfigPath = getEngineerKitConfigPath();

			// Load global engineer kit config from ~/.claude/.ck.json
			let globalConfig: Record<string, unknown> = {};
			if (existsSync(globalConfigPath)) {
				const content = await readFile(globalConfigPath, "utf-8");
				globalConfig = JSON.parse(content);
			}

			// Load local config from project/.claude/.ck.json
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

	// GET /api/config/global - Load engineer kit config from ~/.claude/.ck.json
	app.get("/api/config/global", async (_req: Request, res: Response) => {
		try {
			const globalConfigPath = getEngineerKitConfigPath();
			let config: Record<string, unknown> = {};
			if (existsSync(globalConfigPath)) {
				const content = await readFile(globalConfigPath, "utf-8");
				config = JSON.parse(content);
			}
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

	// POST /api/config - Update engineer kit config
	app.post("/api/config", async (req: Request, res: Response) => {
		try {
			const { scope = "local", config } = req.body;

			if (!config || typeof config !== "object") {
				res.status(400).json({ error: "Invalid config payload" });
				return;
			}

			if (scope === "global") {
				// Save engineer kit config to ~/.claude/.ck.json
				const globalConfigPath = getEngineerKitConfigPath();
				const globalDir = PathResolver.getGlobalKitDir();

				// Ensure ~/.claude directory exists
				if (!existsSync(globalDir)) {
					await mkdir(globalDir, { recursive: true });
				}

				await writeFile(globalConfigPath, JSON.stringify(config, null, 2), "utf-8");
				logger.debug(`Engineer kit config saved to ${globalConfigPath}`);
			} else {
				// Save local project config to project/.claude/.ck.json
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
	const dangerousKeys = ["__proto__", "constructor", "prototype"];

	for (const key of Object.keys(source)) {
		if (dangerousKeys.includes(key)) continue; // Skip dangerous keys

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
