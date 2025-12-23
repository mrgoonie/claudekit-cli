/**
 * Session API routes
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { getProjectSessions } from "@/services/claude-data/index.js";
import type { Express, Request, Response } from "express";

export function registerSessionRoutes(app: Express): void {
	// GET /api/sessions/:projectId - List sessions for a project
	// projectId is the encoded path (e.g., "-home-kai-project")
	app.get("/api/sessions/:projectId", async (req: Request, res: Response) => {
		const { projectId } = req.params;

		// Basic validation to prevent path traversal
		if (projectId.includes("..") || projectId.includes("/")) {
			res.status(400).json({ error: "Invalid project ID" });
			return;
		}

		try {
			const projectDir = join(homedir(), ".claude", "projects", projectId);
			const sessions = await getProjectSessions(projectDir);
			res.json(sessions);
		} catch (error) {
			res.status(500).json({ error: "Failed to list sessions" });
		}
	});
}
