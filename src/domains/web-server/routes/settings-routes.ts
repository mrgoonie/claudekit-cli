/**
 * Settings API routes
 */

import { homedir } from "node:os";
import {
	backupAndSaveSettings,
	countHooks,
	countMcpServers,
	getCurrentModel,
	getSettingsPath,
	readSettings,
} from "@/services/claude-data/index.js";
import type { Express, Request, Response } from "express";
import { z } from "zod";

const HookGroupSchema = z
	.object({
		matcher: z.string().optional(),
		hooks: z.array(z.unknown()),
	})
	.passthrough();

const ClaudeSettingsWriteSchema = z
	.object({
		model: z.string().optional(),
		includeCoAuthoredBy: z.boolean().optional(),
		permissions: z
			.object({
				allow: z.array(z.string()).optional(),
				deny: z.array(z.string()).optional(),
				defaultMode: z.string().optional(),
			})
			.passthrough()
			.optional(),
		hooks: z.record(z.array(HookGroupSchema)).optional(),
		mcpServers: z.record(z.unknown()).optional(),
		statusLine: z.unknown().optional(),
		enabledPlugins: z.record(z.unknown()).optional(),
		effortLevel: z.string().optional(),
	})
	.passthrough();

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
				settingsPath: "~/.claude/settings.json",
				settingsExists: settings !== null,
				settings: settings ?? {},
			});
		} catch (error) {
			res.status(500).json({ error: "Failed to read settings" });
		}
	});

	// GET /api/settings/raw - Read full ~/.claude/settings.json for JSON viewer
	app.get("/api/settings/raw", async (_req: Request, res: Response) => {
		try {
			const settings = await readSettings();
			res.json({
				path: "~/.claude/settings.json",
				exists: settings !== null,
				settings: settings ?? {},
			});
		} catch (error) {
			res.status(500).json({ error: "Failed to read settings file" });
		}
	});

	// PUT /api/settings/raw - Save full ~/.claude/settings.json with backup
	app.put("/api/settings/raw", async (req: Request, res: Response) => {
		try {
			const payload = req.body as { settings?: unknown };
			if (!payload || typeof payload !== "object" || payload.settings === undefined) {
				res.status(400).json({ error: "Missing settings payload" });
				return;
			}
			if (payload.settings === null || typeof payload.settings !== "object") {
				res.status(400).json({ error: "settings must be a JSON object" });
				return;
			}

			const validation = ClaudeSettingsWriteSchema.safeParse(payload.settings);
			if (!validation.success) {
				res.status(400).json({
					error: "Settings validation failed",
					details: validation.error.issues,
				});
				return;
			}

			const saveResult = await backupAndSaveSettings(validation.data as Record<string, unknown>);
			res.json({
				success: true,
				path: "~/.claude/settings.json",
				backupPath: saveResult.backupPath ? saveResult.backupPath.replace(homedir(), "~") : null,
				absolutePath: getSettingsPath(),
			});
		} catch (error) {
			res.status(500).json({ error: "Failed to save settings file" });
		}
	});
}
