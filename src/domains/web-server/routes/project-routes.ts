/**
 * Project API routes
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { ProjectsRegistryManager } from "@/domains/claudekit-data/index.js";
import { ConfigManager } from "@/domains/config/index.js";
import {
	countHooks,
	countMcpServers,
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
	// GET /api/projects - List registered projects
	app.get("/api/projects", async (_req: Request, res: Response) => {
		try {
			const registeredProjects = await ProjectsRegistryManager.listProjects();

			// If registry is empty, fall back to CWD + global detection
			if (registeredProjects.length === 0) {
				const projects: ProjectInfo[] = [];

				// Current working directory project
				const cwd = process.cwd();
				const cwdProject = await detectAndBuildProjectInfo(cwd, "current");
				if (cwdProject) {
					projects.push(cwdProject);
				}

				// Global installation
				const globalDir = join(homedir(), ".claude");
				const globalProject = await detectAndBuildProjectInfo(globalDir, "global");
				if (globalProject) {
					projects.push(globalProject);
				}

				res.json(projects);
				return;
			}

			// Convert registered projects to ProjectInfo
			const projects: ProjectInfo[] = [];
			for (const registered of registeredProjects) {
				const projectInfo = await buildProjectInfoFromRegistry(registered);
				if (projectInfo) {
					projects.push(projectInfo);
				}
			}

			res.json(projects);
		} catch (error) {
			res.status(500).json({ error: "Failed to list projects" });
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
