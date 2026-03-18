import {
	HookDiagnosticsError,
	MAX_HOOK_DIAGNOSTICS_PROJECT_ID_LENGTH,
	readHookDiagnostics,
} from "@/services/claude-data/index.js";
import type { Express, Request, Response } from "express";

function parseLimit(value: unknown): number | undefined {
	if (typeof value !== "string" || value.trim().length === 0) return undefined;
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : undefined;
}

export function registerHookLogRoutes(app: Express): void {
	app.get("/api/system/hook-diagnostics", async (req: Request, res: Response) => {
		const rawScope = typeof req.query.scope === "string" ? req.query.scope : "global";
		if (rawScope !== "global" && rawScope !== "project") {
			res.status(400).json({ error: "scope must be either 'global' or 'project'" });
			return;
		}

		const scope = rawScope;
		const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
		const limit = parseLimit(req.query.limit);

		if (projectId && projectId.length > MAX_HOOK_DIAGNOSTICS_PROJECT_ID_LENGTH) {
			res.status(400).json({
				error: `projectId must be ${MAX_HOOK_DIAGNOSTICS_PROJECT_ID_LENGTH} characters or fewer`,
			});
			return;
		}

		if (scope === "project" && !projectId) {
			res.status(400).json({ error: "projectId is required when scope=project" });
			return;
		}

		try {
			const diagnostics = await readHookDiagnostics({ scope, projectId, limit });
			res.json(diagnostics);
		} catch (error) {
			if (error instanceof HookDiagnosticsError) {
				res.status(error.status).json({ error: error.message });
				return;
			}
			res.status(500).json({ error: "Failed to read hook diagnostics" });
		}
	});
}
