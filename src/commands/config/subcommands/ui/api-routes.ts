import type { Express, Request, Response } from "express";
import { ResolutionTracer } from "@/domains/config/resolution-tracer.js";
import { BackupManager } from "@/domains/config/backup-manager.js";
import {
	getJsonSchema,
	ConfigSchemaWithDescriptions,
} from "@/domains/config/schema-descriptions.js";
import { PathResolver } from "@/shared/path-resolver.js";
import { join } from "node:path";
import { logger } from "@/shared/logger.js";

export function setupApiRoutes(app: Express): void {
	// CORS for local development
	app.use((req, res, next) => {
		res.header("Access-Control-Allow-Origin", "*");
		res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
		res.header("Access-Control-Allow-Headers", "Content-Type");
		if (req.method === "OPTIONS") {
			res.sendStatus(200);
			return;
		}
		next();
	});

	// GET /api/config - Get merged config with sources
	app.get("/api/config", async (_req: Request, res: Response) => {
		try {
			const projectDir = process.cwd();
			const result = await ResolutionTracer.trace(projectDir, false);

			res.json({
				success: true,
				data: {
					merged: unflatten(result.merged),
					traced: result.traced,
					sources: {
						default: unflatten(result.sources.default),
						global: result.sources.global
							? unflatten(result.sources.global)
							: null,
						local: result.sources.local ? unflatten(result.sources.local) : null,
					},
					paths: {
						global: PathResolver.getConfigFile(true),
						local: join(projectDir, ".claude", ".ck.json"),
					},
				},
			});
		} catch (error) {
			logger.error(`API error: ${error}`);
			res.status(500).json({
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
	});

	// POST /api/config - Update config
	app.post("/api/config", async (req: Request, res: Response) => {
		try {
			const { scope, config } = req.body as {
				scope: "global" | "local";
				config: Record<string, unknown>;
			};

			const configPath =
				scope === "global"
					? PathResolver.getConfigFile(true)
					: join(process.cwd(), ".claude", ".ck.json");

			// Create backup
			const backupPath = await BackupManager.createBackup(configPath);

			// Write config
			const result = await BackupManager.atomicWrite(
				configPath,
				JSON.stringify(config, null, 2),
			);

			if (!result.success) {
				res.status(500).json({
					success: false,
					error: "Failed to write config",
				});
				return;
			}

			res.json({
				success: true,
				data: {
					path: configPath,
					backupPath,
				},
			});
		} catch (error) {
			logger.error(`API error: ${error}`);
			res.status(500).json({
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
	});

	// GET /api/schema - Get JSON schema
	app.get("/api/schema", (_req: Request, res: Response) => {
		res.json({
			success: true,
			data: getJsonSchema(),
		});
	});

	// POST /api/validate - Validate config
	app.post("/api/validate", async (req: Request, res: Response) => {
		try {
			const { config } = req.body as { config: Record<string, unknown> };

			const result = ConfigSchemaWithDescriptions.safeParse(config);

			if (result.success) {
				res.json({
					success: true,
					data: { valid: true },
				});
			} else {
				res.json({
					success: true,
					data: {
						valid: false,
						errors: result.error.issues.map((issue) => ({
							path: issue.path.join("."),
							message: issue.message,
						})),
					},
				});
			}
		} catch (error) {
			res.status(500).json({
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
	});

	// GET /api/preview - Preview merged config with pending changes
	app.get("/api/preview", async (_req: Request, res: Response) => {
		try {
			const projectDir = process.cwd();
			const result = await ResolutionTracer.trace(projectDir, false);

			res.json({
				success: true,
				data: {
					preview: unflatten(result.merged),
				},
			});
		} catch (error) {
			res.status(500).json({
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
	});

	// GET /api/backups - List available backups
	app.get("/api/backups", async (req: Request, res: Response) => {
		try {
			const scope = (req.query.scope as string) || "local";
			const configPath =
				scope === "global"
					? PathResolver.getConfigFile(true)
					: join(process.cwd(), ".claude", ".ck.json");

			const backups = await BackupManager.listBackups(configPath);

			res.json({
				success: true,
				data: { backups },
			});
		} catch (error) {
			res.status(500).json({
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
	});

	// POST /api/restore - Restore from backup
	app.post("/api/restore", async (req: Request, res: Response) => {
		try {
			const { backupPath, scope } = req.body as {
				backupPath: string;
				scope: "global" | "local";
			};

			const configPath =
				scope === "global"
					? PathResolver.getConfigFile(true)
					: join(process.cwd(), ".claude", ".ck.json");

			const success = await BackupManager.restore(backupPath, configPath);

			res.json({
				success,
				data: success ? { restored: configPath } : null,
				error: success ? null : "Restore failed",
			});
		} catch (error) {
			res.status(500).json({
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
	});
}

function unflatten(obj: Record<string, unknown>): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj)) {
		const keys = key.split(".");
		let current = result;
		for (let i = 0; i < keys.length - 1; i++) {
			if (!(keys[i] in current)) current[keys[i]] = {};
			current = current[keys[i]] as Record<string, unknown>;
		}
		current[keys[keys.length - 1]] = value;
	}
	return result;
}
