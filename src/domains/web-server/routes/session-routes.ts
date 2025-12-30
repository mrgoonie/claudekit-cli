/**
 * Session API routes
 *
 * Claude CLI stores sessions in ~/.claude/projects/{dash-encoded-path}/
 * where dash-encoded-path is the project path with / replaced by -
 * e.g., /home/kai/myproject → -home-kai-myproject
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { ProjectsRegistryManager } from "@/domains/claudekit-data/index.js";
import { getProjectSessions } from "@/services/claude-data/index.js";
import type { Express, Request, Response } from "express";

/**
 * Convert project ID to Claude's dash-encoded session directory path.
 * Handles: discovered-{base64url}, registry UUIDs, and legacy IDs (current/global)
 */
async function resolveSessionDir(projectId: string): Promise<string | null> {
	const home = homedir();

	// Handle discovered projects: discovered-{base64url encoded path}
	if (projectId.startsWith("discovered-")) {
		try {
			const encodedPath = projectId.slice("discovered-".length);
			const projectPath = Buffer.from(encodedPath, "base64url").toString("utf-8");
			// Claude encodes paths by replacing / with -
			const claudeEncoded = projectPath.replace(/\//g, "-");
			return join(home, ".claude", "projects", claudeEncoded);
		} catch {
			return null;
		}
	}

	// Handle legacy IDs
	if (projectId === "current") {
		const cwdEncoded = process.cwd().replace(/\//g, "-");
		return join(home, ".claude", "projects", cwdEncoded);
	}
	if (projectId === "global") {
		const globalEncoded = join(home, ".claude").replace(/\//g, "-");
		return join(home, ".claude", "projects", globalEncoded);
	}

	// Handle registry projects: look up by ID to get path
	const registered = await ProjectsRegistryManager.getProject(projectId);
	if (registered) {
		const claudeEncoded = registered.path.replace(/\//g, "-");
		return join(home, ".claude", "projects", claudeEncoded);
	}

	return null;
}

export function registerSessionRoutes(app: Express): void {
	// GET /api/sessions/:projectId - List sessions for a project
	app.get("/api/sessions/:projectId", async (req: Request, res: Response) => {
		const { projectId } = req.params;
		const decodedId = decodeURIComponent(projectId);

		// Block path traversal in raw ID
		if (decodedId.includes("..")) {
			res.status(400).json({ error: "Invalid project ID" });
			return;
		}

		const projectDir = await resolveSessionDir(decodedId);
		if (!projectDir) {
			res.status(404).json({ error: "Project not found" });
			return;
		}

		// Verify resolved path is within allowed directory
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
