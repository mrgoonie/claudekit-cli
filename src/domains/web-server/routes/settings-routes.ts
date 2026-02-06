import { existsSync } from "node:fs";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import {
	countHooks,
	countMcpServers,
	extractHooks,
	getCurrentModel,
	readMcpServers,
	readSettings,
} from "@/services/claude-data/index.js";
import type { Express, Request, Response } from "express";

const settingsPath = join(homedir(), ".claude", "settings.json");

export function registerSettingsRoutes(app: Express): void {
	// GET /api/settings - Read Claude settings (structured)
	app.get("/api/settings", async (_req: Request, res: Response) => {
		try {
			const settings = await readSettings();

			// Model priority: env var > settings.json > default
			const model = getCurrentModel() || settings?.model || "claude-sonnet-4";
			const hookCount = settings ? countHooks(settings) : 0;
			const mcpServerCount = settings ? countMcpServers(settings) : 0;

			// Extract detailed information
			const hooks = settings ? extractHooks(settings) : [];
			const mcpServers = await readMcpServers();

			res.json({
				model,
				hookCount,
				hooks,
				mcpServerCount,
				mcpServers,
				permissions: settings?.permissions || null,
			});
		} catch (error) {
			res.status(500).json({ error: "Failed to read settings" });
		}
	});

	// GET /api/settings/full - Read raw settings.json content
	app.get("/api/settings/full", async (_req: Request, res: Response) => {
		try {
			if (!existsSync(settingsPath)) {
				res.json({});
				return;
			}
			const content = await readFile(settingsPath, "utf-8");
			res.json(JSON.parse(content));
		} catch (error) {
			res.status(500).json({ error: "Failed to read settings file" });
		}
	});

	// PATCH /api/settings - Selective update (model field only)
	app.patch("/api/settings", async (req: Request, res: Response) => {
		try {
			const body = req.body as Record<string, unknown>;
			const allowedFields = ["model"];
			const invalidFields = Object.keys(body).filter((k) => !allowedFields.includes(k));

			if (invalidFields.length > 0) {
				res.status(400).json({
					error: `Only these fields can be patched: ${allowedFields.join(", ")}. Invalid: ${invalidFields.join(", ")}`,
				});
				return;
			}

			if (!body.model || typeof body.model !== "string") {
				res.status(400).json({ error: "model must be a non-empty string" });
				return;
			}

			// Read current settings
			let current: Record<string, unknown> = {};
			if (existsSync(settingsPath)) {
				const content = await readFile(settingsPath, "utf-8");
				current = JSON.parse(content);

				// Create backup
				await copyFile(settingsPath, `${settingsPath}.bak`);
			}

			// Merge and write
			const updated = { ...current, model: body.model };
			await writeFile(settingsPath, JSON.stringify(updated, null, 2), "utf-8");

			res.json({ success: true, model: body.model });
		} catch (error) {
			res.status(500).json({ error: "Failed to update settings" });
		}
	});
}
