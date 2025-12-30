/**
 * Project API routes
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { ProjectsRegistryManager, scanClaudeProjects } from "@/domains/claudekit-data/index.js";
import { ConfigManager } from "@/domains/config/index.js";
import {
	countHooks,
	countMcpServers,
	mergeProjectDiscovery,
	readGlmSettings,
	readSettings,
	scanSkills,
} from "@/services/claude-data/index.js";
import type { RegisteredProject } from "@/types";
import type { Express, Request, Response } from "express";
import { z } from "zod";
import type { ProjectInfo } from "../types.js";

const AddProjectRequestSchema = z.object({
	path: z.string().min(1).max(500),
	alias: z.string().max(100).optional(),
	pinned: z.boolean().optional(),
	tags: z.array(z.string().max(50)).max(20).optional(),
});

const UpdateProjectRequestSchema = z.object({
	alias: z.string().max(100).optional(),
	pinned: z.boolean().optional(),
	tags: z.array(z.string().max(50)).max(20).optional(),
});

export function registerProjectRoutes(app: Express): void {
	// GET /api/projects - List projects from registry + Claude CLI discovery + history
	// Query params:
	//   ?sortBy=recency - Sort by lastUsed (from history integration)
	//   ?filterNonExistent=true - Exclude paths that don't exist on filesystem
	app.get("/api/projects", async (req: Request, res: Response) => {
		try {
			const sortBy = (req.query.sortBy as string) || "default";
			const filterNonExistent = req.query.filterNonExistent === "true";

			const registeredProjects = await ProjectsRegistryManager.listProjects();
			const registeredPaths = new Set(registeredProjects.map((p) => p.path));

			// Build project info for registered projects
			const projects: ProjectInfo[] = [];
			for (const registered of registeredProjects) {
				const projectInfo = await buildProjectInfoFromRegistry(registered);
				if (projectInfo) {
					projects.push(projectInfo);
				}
			}

			// Discover projects from Claude CLI's ~/.claude/projects/
			// Only add if not already in registry
			const discoveredProjects = scanClaudeProjects();
			for (const discovered of discoveredProjects) {
				if (registeredPaths.has(discovered.path)) continue;

				// Skip global installation - it's not a "project"
				if (discovered.path === join(homedir(), ".claude")) continue;

				const projectInfo = await detectAndBuildProjectInfo(
					discovered.path,
					`discovered-${discovered.path}`,
				);
				if (projectInfo) {
					// Use URL-safe base64 ID for discovered projects (path contains /)
					const encodedPath = Buffer.from(discovered.path).toString("base64url");
					projectInfo.id = `discovered-${encodedPath}`;
					projectInfo.name = basename(discovered.path);
					projects.push(projectInfo);
				}
			}

			// If still empty, fall back to CWD + global
			if (projects.length === 0) {
				const cwd = process.cwd();
				const cwdProject = await detectAndBuildProjectInfo(cwd, "current");
				if (cwdProject) {
					projects.push(cwdProject);
				}

				const globalDir = join(homedir(), ".claude");
				const globalProject = await detectAndBuildProjectInfo(globalDir, "global");
				if (globalProject) {
					projects.push(globalProject);
				}
			}

			// Enhanced: Merge with history data if sortBy=recency
			if (sortBy === "recency") {
				try {
					const sessionProjects = projects.map((p) => ({
						path: p.path,
						lastUsed: p.lastOpened ? new Date(p.lastOpened).getTime() : undefined,
					}));

					const discoveryResult = await mergeProjectDiscovery(sessionProjects, filterNonExistent);

					// Enrich projects with history metadata
					const historyMap = new Map(discoveryResult.projects.map((p) => [p.path, p]));
					for (const project of projects) {
						const historyData = historyMap.get(project.path);
						if (historyData) {
							project.source = historyData.source;
							if (historyData.interactionCount !== undefined) {
								project.interactionCount = historyData.interactionCount;
							}
						}
					}

					// Sort by lastUsed from history
					projects.sort((a, b) => {
						const aHistory = historyMap.get(a.path);
						const bHistory = historyMap.get(b.path);
						const aTime = aHistory?.lastUsed ?? 0;
						const bTime = bHistory?.lastUsed ?? 0;
						return bTime - aTime;
					});

					// Add metadata to response
					res.json({
						projects,
						meta: {
							totalFromSessions: discoveryResult.totalFromSessions,
							totalFromHistory: discoveryResult.totalFromHistory,
							parseTimeMs: discoveryResult.parseTimeMs,
							error: discoveryResult.error,
						},
					});
					return;
				} catch (error) {
					// Fall through to default response if history integration fails
					const message = error instanceof Error ? error.message : "Unknown error";
					console.warn("[/api/projects] History integration failed:", message);
					res.json({
						projects,
						meta: {
							warning: `History data unavailable: ${message}`,
							fallbackMode: true,
						},
					});
					return;
				}
			}

			res.json(projects);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			res.status(500).json({ error: `Failed to list projects: ${message}` });
		}
	});

	// POST /api/projects - Add project to registry
	app.post("/api/projects", async (req: Request, res: Response) => {
		try {
			const validation = AddProjectRequestSchema.safeParse(req.body);
			if (!validation.success) {
				res.status(400).json({
					error: "Invalid request",
					details: validation.error.issues,
				});
				return;
			}

			const body = validation.data;

			const registered = await ProjectsRegistryManager.addProject(body.path, {
				alias: body.alias,
				pinned: body.pinned,
				tags: body.tags,
			});

			const projectInfo = await buildProjectInfoFromRegistry(registered);
			if (!projectInfo) {
				res.status(404).json({ error: "Project directory not found" });
				return;
			}

			res.status(201).json(projectInfo);
		} catch (error) {
			res.status(500).json({ error: "Failed to add project" });
		}
	});

	// GET /api/projects/:id - Get single project
	app.get("/api/projects/:id", async (req: Request, res: Response) => {
		const { id } = req.params;

		try {
			// Try registry first
			const registered = await ProjectsRegistryManager.getProject(id);
			if (registered) {
				// Touch lastOpened
				await ProjectsRegistryManager.touchProject(id);

				const projectInfo = await buildProjectInfoFromRegistry(registered);
				if (!projectInfo) {
					res.status(404).json({ error: "Project directory not found" });
					return;
				}

				res.json(projectInfo);
				return;
			}

			// Handle discovered projects (base64url encoded path)
			if (id.startsWith("discovered-")) {
				try {
					const encodedPath = id.slice("discovered-".length);
					const projectPath = Buffer.from(encodedPath, "base64url").toString("utf-8");
					const projectInfo = await detectAndBuildProjectInfo(projectPath, id);
					if (projectInfo) {
						projectInfo.id = id;
						projectInfo.name = basename(projectPath);
						res.json(projectInfo);
						return;
					}
				} catch {
					// Fall through to 404
				}
				res.status(404).json({ error: "Discovered project not found" });
				return;
			}

			// Fall back to legacy detection for "current" and "global"
			let projectPath: string;
			if (id === "current") {
				projectPath = process.cwd();
			} else if (id === "global") {
				projectPath = join(homedir(), ".claude");
			} else {
				res.status(404).json({ error: "Project not found" });
				return;
			}

			const project = await detectAndBuildProjectInfo(projectPath, id);
			if (!project) {
				res.status(404).json({ error: "Project not found" });
				return;
			}

			res.json(project);
		} catch (error) {
			res.status(500).json({ error: "Failed to get project" });
		}
	});

	// PATCH /api/projects/:id - Update project
	app.patch("/api/projects/:id", async (req: Request, res: Response) => {
		const { id } = req.params;

		try {
			const validation = UpdateProjectRequestSchema.safeParse(req.body);
			if (!validation.success) {
				res.status(400).json({
					error: "Invalid request",
					details: validation.error.issues,
				});
				return;
			}

			const body = validation.data;
			const updated = await ProjectsRegistryManager.updateProject(id, {
				alias: body.alias,
				pinned: body.pinned,
				tags: body.tags,
			});

			if (!updated) {
				res.status(404).json({ error: "Project not found" });
				return;
			}

			const projectInfo = await buildProjectInfoFromRegistry(updated);
			if (!projectInfo) {
				res.status(404).json({ error: "Project directory not found" });
				return;
			}

			res.json(projectInfo);
		} catch (error) {
			res.status(500).json({ error: "Failed to update project" });
		}
	});

	// DELETE /api/projects/:id - Remove project from registry
	app.delete("/api/projects/:id", async (req: Request, res: Response) => {
		const { id } = req.params;

		try {
			const removed = await ProjectsRegistryManager.removeProject(id);
			if (!removed) {
				res.status(404).json({ error: "Project not found" });
				return;
			}

			res.status(204).send();
		} catch (error) {
			res.status(500).json({ error: "Failed to delete project" });
		}
	});
}

/**
 * Build ProjectInfo from registered project
 * Returns null if project directory no longer exists
 */
async function buildProjectInfoFromRegistry(
	registered: RegisteredProject,
): Promise<ProjectInfo | null> {
	const claudeDir = join(registered.path, ".claude");
	const metadataPath = join(claudeDir, "metadata.json");

	// Filter out deleted/moved projects
	if (!existsSync(claudeDir)) {
		return null;
	}

	let metadata: Record<string, unknown> = {};
	try {
		if (existsSync(metadataPath)) {
			const content = await readFile(metadataPath, "utf-8");
			metadata = JSON.parse(content);
		}
	} catch {
		// Ignore parse errors
	}

	const hasLocalConfig = ConfigManager.projectConfigExists(registered.path, false);

	// Get enhanced fields from Claude data services
	const settings = await readSettings();
	const glmSettings = await readGlmSettings();
	const skills = await scanSkills();

	// Determine health based on settings.json existence
	const settingsPath = join(homedir(), ".claude", "settings.json");
	const health = existsSync(settingsPath) ? "healthy" : "warning";

	return {
		id: registered.id,
		name: registered.alias,
		path: registered.path,
		hasLocalConfig,
		kitType: (metadata.kit as string) || null,
		version: (metadata.version as string) || null,
		// Enhanced fields
		health,
		model: glmSettings?.model || settings?.model || "claude-sonnet-4-20250514",
		activeHooks: settings ? countHooks(settings) : 0,
		mcpServers: settings ? countMcpServers(settings) : 0,
		skills: skills.map((s) => s.id),
		// Registry fields
		pinned: registered.pinned,
		tags: registered.tags,
		addedAt: registered.addedAt,
		lastOpened: registered.lastOpened,
	};
}

/**
 * Legacy detection for CWD and global projects
 * Used as fallback when registry is empty or for special IDs
 */
async function detectAndBuildProjectInfo(path: string, id: string): Promise<ProjectInfo | null> {
	// Check for ClaudeKit markers
	const claudeDir = id === "global" ? path : join(path, ".claude");
	const metadataPath = join(claudeDir, "metadata.json");

	if (!existsSync(metadataPath)) {
		// Still return if has .claude directory
		if (!existsSync(claudeDir)) {
			return null;
		}
	}

	let metadata: Record<string, unknown> = {};
	try {
		if (existsSync(metadataPath)) {
			const content = await readFile(metadataPath, "utf-8");
			metadata = JSON.parse(content);
		}
	} catch {
		// Ignore parse errors
	}

	const hasLocalConfig = ConfigManager.projectConfigExists(path, id === "global");

	// Get enhanced fields from Claude data services
	const settings = await readSettings();
	const glmSettings = await readGlmSettings();
	const skills = await scanSkills();

	// Determine health based on settings.json existence
	const settingsPath = join(homedir(), ".claude", "settings.json");
	const health = existsSync(settingsPath) ? "healthy" : "warning";

	return {
		id,
		name: basename(path) || (id === "global" ? "Global" : "Current"),
		path,
		hasLocalConfig,
		kitType: (metadata.kit as string) || null,
		version: (metadata.version as string) || null,
		// Enhanced fields
		health,
		model: glmSettings?.model || settings?.model || "claude-sonnet-4-20250514",
		activeHooks: settings ? countHooks(settings) : 0,
		mcpServers: settings ? countMcpServers(settings) : 0,
		skills: skills.map((s) => s.id),
	};
}
