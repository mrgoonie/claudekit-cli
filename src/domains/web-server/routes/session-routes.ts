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

		// Decode and validate
		const decodedId = decodeURIComponent(projectId);

		// Block path traversal (Unix and Windows)
		if (decodedId.includes("..") || decodedId.includes("/") || decodedId.includes("\\")) {
			res.status(400).json({ error: "Invalid project ID" });
			return;
		}

		const projectDir = join(homedir(), ".claude", "projects", decodedId);

		// Verify path is within allowed directory
		const allowedBase = join(homedir(), ".claude", "projects");
		if (!projectDir.startsWith(allowedBase)) {
			res.status(403).json({ error: "Access denied" });
			return;
		}

		try {
			const sessions = await getProjectSessions(projectDir);
			res.json(sessions);
		} catch (error) {
			res.status(500).json({ error: "Failed to list sessions" });
		}
	});
}
