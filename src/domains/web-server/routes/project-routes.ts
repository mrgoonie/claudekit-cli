/**
 * Project API routes
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { ConfigManager } from "@/domains/config/index.js";
import type { Express, Request, Response } from "express";
import type { ProjectInfo } from "../types.js";

export function registerProjectRoutes(app: Express): void {
	// GET /api/projects - List detected projects
	app.get("/api/projects", async (_req: Request, res: Response) => {
		try {
			const projects: ProjectInfo[] = [];

			// Current working directory project
			const cwd = process.cwd();
			const cwdProject = await detectProject(cwd, "current");
			if (cwdProject) {
				projects.push(cwdProject);
			}

			// Global installation
			const globalDir = join(homedir(), ".claude");
			const globalProject = await detectProject(globalDir, "global");
			if (globalProject) {
				projects.push(globalProject);
			}

			res.json(projects);
		} catch (error) {
			res.status(500).json({ error: "Failed to list projects" });
		}
	});

	// GET /api/projects/:id
	app.get("/api/projects/:id", async (req: Request, res: Response) => {
		const { id } = req.params;

		try {
			let projectPath: string;
			if (id === "current") {
				projectPath = process.cwd();
			} else if (id === "global") {
				projectPath = join(homedir(), ".claude");
			} else {
				res.status(404).json({ error: "Project not found" });
				return;
			}

			const project = await detectProject(projectPath, id);
			if (!project) {
				res.status(404).json({ error: "Project not found" });
				return;
			}

			res.json(project);
		} catch (error) {
			res.status(500).json({ error: "Failed to get project" });
		}
	});
}

async function detectProject(path: string, id: string): Promise<ProjectInfo | null> {
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

	return {
		id,
		name: basename(path) || (id === "global" ? "Global" : "Current"),
		path,
		hasLocalConfig,
		kitType: (metadata.kit as string) || null,
		version: (metadata.version as string) || null,
	};
}
