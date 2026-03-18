import { readHookDiagnostics } from "@/services/claude-data/index.js";
import type { Express, Request, Response } from "express";

function parseLimit(value: unknown): number | undefined {
	if (typeof value !== "string" || value.trim().length === 0) return undefined;
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : undefined;
}

export function registerHookLogRoutes(app: Express): void {
	app.get("/api/system/hook-diagnostics", async (req: Request, res: Response) => {
		const scope = req.query.scope === "project" ? "project" : "global";
		const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
		const limit = parseLimit(req.query.limit);

		if (scope === "project" && !projectId) {
			res.status(400).json({ error: "projectId is required when scope=project" });
			return;
		}

		try {
			const diagnostics = await readHookDiagnostics({ scope, projectId, limit });
			res.json(diagnostics);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Failed to read hook diagnostics";
			const status = message === "Project not found" ? 404 : 500;
			res.status(status).json({ error: message });
		}
	});
}
