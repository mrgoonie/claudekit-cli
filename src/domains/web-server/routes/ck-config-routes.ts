/**
 * CK Config API routes - Full .ck.json config with source tracking
 *
 * Endpoints:
 * - GET /api/ck-config - Load full config with sources
 * - PUT /api/ck-config - Save full config
 * - GET /api/ck-config/schema - Return JSON Schema
 * - GET /api/metadata/global - Load global metadata
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CkConfigManager } from "@/domains/config/index.js";
import ckConfigSchema from "@/schemas/ck-config.schema.json" with { type: "json" };
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import { type CkConfig, CkConfigSchema } from "@/types";
import type { Express, Request, Response } from "express";

/**
 * Resolve project directory from projectId
 * Returns null for global-only requests
 */
async function resolveProjectDir(projectId: string | undefined): Promise<string | null> {
	if (!projectId) return null;

	// Handle discovered projects (base64url encoded path)
	if (projectId.startsWith("discovered-")) {
		const encodedPath = projectId.slice("discovered-".length);
		return Buffer.from(encodedPath, "base64url").toString("utf-8");
	}

	// Resolve from registry
	const { ProjectsRegistryManager } = await import("@/domains/claudekit-data/projects-registry.js");
	const project = await ProjectsRegistryManager.getProject(projectId);
	return project?.path ?? null;
}

export function registerCkConfigRoutes(app: Express): void {
	/**
	 * GET /api/ck-config
	 * Load full .ck.json config with source tracking
	 *
	 * Query params:
	 * - projectId: string (optional) - Project ID for project-specific config
	 * - scope: "global" | "project" | "merged" (default: "merged")
	 */
	app.get("/api/ck-config", async (req: Request, res: Response) => {
		try {
			const { projectId, scope = "merged" } = req.query as {
				projectId?: string;
				scope?: "global" | "project" | "merged";
			};

			const projectDir = await resolveProjectDir(projectId);

			if (scope === "global") {
				const config = await CkConfigManager.loadScope("global", null);
				res.json({
					config: config || {},
					sources: {},
					globalPath: CkConfigManager.getGlobalConfigPath(),
					projectPath: null,
				});
				return;
			}

			if (scope === "project") {
				if (!projectDir) {
					res.status(400).json({ error: "projectId required for project scope" });
					return;
				}
				const config = await CkConfigManager.loadScope("project", projectDir);
				res.json({
					config: config || {},
					sources: {},
					globalPath: CkConfigManager.getGlobalConfigPath(),
					projectPath: CkConfigManager.getProjectConfigPath(projectDir),
				});
				return;
			}

			// Default: merged with source tracking
			const result = await CkConfigManager.loadFull(projectDir);
			res.json(result);
		} catch (error) {
			logger.error(`Failed to load ck-config: ${error}`);
			res.status(500).json({ error: "Failed to load configuration" });
		}
	});

	/**
	 * PUT /api/ck-config
	 * Save .ck.json config to specified scope
	 *
	 * Request body:
	 * - scope: "global" | "project"
	 * - projectId: string (required for project scope)
	 * - config: CkConfig object
	 */
	app.put("/api/ck-config", async (req: Request, res: Response) => {
		try {
			const { scope, projectId, config } = req.body as {
				scope: "global" | "project";
				projectId?: string;
				config: CkConfig;
			};

			// Validate scope
			if (!scope || !["global", "project"].includes(scope)) {
				res.status(400).json({ error: "Invalid scope. Must be 'global' or 'project'" });
				return;
			}

			// Validate config
			if (!config || typeof config !== "object") {
				res.status(400).json({ error: "Invalid config payload" });
				return;
			}

			// Validate against schema
			const parseResult = CkConfigSchema.safeParse(config);
			if (!parseResult.success) {
				res.status(400).json({
					error: "Config validation failed",
					details: parseResult.error.issues,
				});
				return;
			}

			// Resolve project directory for project scope
			let projectDir: string | null = null;
			if (scope === "project") {
				if (!projectId) {
					res.status(400).json({ error: "projectId required for project scope" });
					return;
				}
				projectDir = await resolveProjectDir(projectId);
				if (!projectDir) {
					res.status(404).json({ error: "Project not found" });
					return;
				}
			}

			// Save config
			const savedPath = await CkConfigManager.saveFull(parseResult.data, scope, projectDir);

			res.json({
				success: true,
				path: savedPath,
				scope,
			});
		} catch (error) {
			logger.error(`Failed to save ck-config: ${error}`);
			res.status(500).json({ error: "Failed to save configuration" });
		}
	});

	/**
	 * GET /api/ck-config/schema
	 * Return the JSON Schema for .ck.json
	 */
	app.get("/api/ck-config/schema", (_req: Request, res: Response) => {
		res.json(ckConfigSchema);
	});

	/**
	 * PATCH /api/ck-config/field
	 * Update a single field at specified scope
	 *
	 * Request body:
	 * - scope: "global" | "project"
	 * - projectId: string (required for project scope)
	 * - fieldPath: string (dot-notation path)
	 * - value: any
	 */
	app.patch("/api/ck-config/field", async (req: Request, res: Response) => {
		try {
			const { scope, projectId, fieldPath, value } = req.body as {
				scope: "global" | "project";
				projectId?: string;
				fieldPath: string;
				value: unknown;
			};

			// Validate inputs
			if (!scope || !["global", "project"].includes(scope)) {
				res.status(400).json({ error: "Invalid scope" });
				return;
			}

			if (!fieldPath || typeof fieldPath !== "string") {
				res.status(400).json({ error: "fieldPath required" });
				return;
			}

			// Resolve project directory
			let projectDir: string | null = null;
			if (scope === "project") {
				if (!projectId) {
					res.status(400).json({ error: "projectId required for project scope" });
					return;
				}
				projectDir = await resolveProjectDir(projectId);
				if (!projectDir) {
					res.status(404).json({ error: "Project not found" });
					return;
				}
			}

			// Update field
			await CkConfigManager.updateField(fieldPath, value, scope, projectDir);

			res.json({ success: true, fieldPath, value, scope });
		} catch (error) {
			logger.error(`Failed to update ck-config field: ${error}`);
			res.status(500).json({ error: "Failed to update field" });
		}
	});

	/**
	 * GET /api/metadata/global
	 * Load global metadata from ~/.claude/metadata.json
	 */
	app.get("/api/metadata/global", async (_req: Request, res: Response) => {
		try {
			const metadataPath = join(PathResolver.getGlobalKitDir(), "metadata.json");
			let metadata: Record<string, unknown> = {};
			if (existsSync(metadataPath)) {
				const content = await readFile(metadataPath, "utf-8");
				try {
					metadata = JSON.parse(content);
				} catch {
					// Ignore JSON parse errors, use empty object
				}
			}
			res.json(metadata);
		} catch (error) {
			logger.error(`Failed to load global metadata: ${error}`);
			res.status(500).json({ error: "Failed to load metadata" });
		}
	});
}
