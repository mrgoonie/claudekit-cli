/**
 * Control Center API Routes
 * Provides REST endpoints for the Control Center dashboard
 */
import {
	addProject,
	checkHealth,
	executeCcsCommand,
	getRecentSessions,
	getSuggestions,
	launchClaude,
	listSkills,
	loadProjects,
	openEditor,
	openTerminal,
	removeProject,
} from "@/domains/control-center/index.js";
import { logger } from "@/shared/logger.js";
import type { Express, Request, Response } from "express";

interface ApiResponse<T = unknown> {
	success: boolean;
	data?: T;
	error?: string;
}

/**
 * Send a standardized API response
 */
function sendResponse<T>(res: Response, data: T, status = 200): void {
	res.status(status).json({ success: true, data } as ApiResponse<T>);
}

/**
 * Send a standardized error response
 */
function sendError(res: Response, error: string, status = 500): void {
	res.status(status).json({ success: false, error } as ApiResponse);
}

/**
 * Setup Control Center API routes
 */
export function setupControlCenterRoutes(app: Express): void {
	// ==================== Projects ====================

	/**
	 * GET /api/projects - List all managed projects
	 */
	app.get("/api/projects", async (_req: Request, res: Response) => {
		try {
			const projects = await loadProjects();
			sendResponse(res, { projects });
		} catch (error) {
			logger.error(`API error [GET /api/projects]: ${error}`);
			sendError(res, error instanceof Error ? error.message : "Unknown error");
		}
	});

	/**
	 * POST /api/projects - Add a project to the managed list
	 * Body: { path: string, name?: string }
	 */
	app.post("/api/projects", async (req: Request, res: Response) => {
		try {
			const { path, name } = req.body as { path: string; name?: string };

			if (!path || typeof path !== "string") {
				sendError(res, "Path is required", 400);
				return;
			}

			const project = await addProject(path, name);
			sendResponse(res, { project }, 201);
		} catch (error) {
			logger.error(`API error [POST /api/projects]: ${error}`);
			sendError(res, error instanceof Error ? error.message : "Unknown error");
		}
	});

	/**
	 * DELETE /api/projects/:id - Remove a project from the managed list
	 */
	app.delete("/api/projects/:id", async (req: Request, res: Response) => {
		try {
			const { id } = req.params;

			if (!id) {
				sendError(res, "Project ID is required", 400);
				return;
			}

			const removed = await removeProject(id);

			if (removed) {
				sendResponse(res, { removed: true });
			} else {
				sendError(res, "Project not found", 404);
			}
		} catch (error) {
			logger.error(`API error [DELETE /api/projects/:id]: ${error}`);
			sendError(res, error instanceof Error ? error.message : "Unknown error");
		}
	});

	/**
	 * GET /api/projects/suggestions - Get project suggestions from Claude history
	 */
	app.get("/api/projects/suggestions", async (_req: Request, res: Response) => {
		try {
			const suggestions = await getSuggestions();
			sendResponse(res, { suggestions });
		} catch (error) {
			logger.error(`API error [GET /api/projects/suggestions]: ${error}`);
			sendError(res, error instanceof Error ? error.message : "Unknown error");
		}
	});

	// ==================== Skills ====================

	/**
	 * GET /api/skills - List all skills with metadata
	 */
	app.get("/api/skills", async (_req: Request, res: Response) => {
		try {
			const skills = await listSkills();
			sendResponse(res, { skills });
		} catch (error) {
			logger.error(`API error [GET /api/skills]: ${error}`);
			sendError(res, error instanceof Error ? error.message : "Unknown error");
		}
	});

	// ==================== Sessions ====================

	/**
	 * GET /api/sessions/:projectId - Get recent sessions for a project
	 * projectId is the encoded project path (base64 or slug)
	 */
	app.get("/api/sessions/:projectId", async (req: Request, res: Response) => {
		try {
			const { projectId } = req.params;
			const limit = Number.parseInt(req.query.limit as string, 10) || 5;

			if (!projectId) {
				sendError(res, "Project ID is required", 400);
				return;
			}

			// Decode projectId - it's a base64 encoded path
			let projectPath: string;
			try {
				projectPath = Buffer.from(projectId, "base64").toString("utf-8");
			} catch {
				// Fallback: treat as direct path
				projectPath = decodeURIComponent(projectId);
			}

			const sessions = await getRecentSessions(projectPath, limit);
			sendResponse(res, { sessions });
		} catch (error) {
			logger.error(`API error [GET /api/sessions/:projectId]: ${error}`);
			sendError(res, error instanceof Error ? error.message : "Unknown error");
		}
	});

	// ==================== Actions ====================

	/**
	 * POST /api/actions/terminal - Open terminal at path
	 * Body: { path: string }
	 */
	app.post("/api/actions/terminal", async (req: Request, res: Response) => {
		try {
			const { path } = req.body as { path: string };

			if (!path || typeof path !== "string") {
				sendError(res, "Path is required", 400);
				return;
			}

			const result = await openTerminal(path);

			if (result.success) {
				sendResponse(res, { opened: true });
			} else {
				sendError(res, result.error || "Failed to open terminal");
			}
		} catch (error) {
			logger.error(`API error [POST /api/actions/terminal]: ${error}`);
			sendError(res, error instanceof Error ? error.message : "Unknown error");
		}
	});

	/**
	 * POST /api/actions/editor - Open editor at path
	 * Body: { path: string }
	 */
	app.post("/api/actions/editor", async (req: Request, res: Response) => {
		try {
			const { path } = req.body as { path: string };

			if (!path || typeof path !== "string") {
				sendError(res, "Path is required", 400);
				return;
			}

			const result = await openEditor(path);

			if (result.success) {
				sendResponse(res, { opened: true });
			} else {
				sendError(res, result.error || "Failed to open editor");
			}
		} catch (error) {
			logger.error(`API error [POST /api/actions/editor]: ${error}`);
			sendError(res, error instanceof Error ? error.message : "Unknown error");
		}
	});

	/**
	 * POST /api/actions/claude - Launch Claude Code at path
	 * Body: { path: string }
	 */
	app.post("/api/actions/claude", async (req: Request, res: Response) => {
		try {
			const { path } = req.body as { path: string };

			if (!path || typeof path !== "string") {
				sendError(res, "Path is required", 400);
				return;
			}

			const result = await launchClaude(path);

			if (result.success) {
				sendResponse(res, { launched: true });
			} else {
				sendError(res, result.error || "Failed to launch Claude");
			}
		} catch (error) {
			logger.error(`API error [POST /api/actions/claude]: ${error}`);
			sendError(res, error instanceof Error ? error.message : "Unknown error");
		}
	});

	/**
	 * POST /api/actions/ccs - Execute a CCS (ClaudeKit CLI) command
	 * Body: { command: string }
	 */
	app.post("/api/actions/ccs", async (req: Request, res: Response) => {
		try {
			const { command } = req.body as { command: string };

			if (!command || typeof command !== "string") {
				sendError(res, "Command is required", 400);
				return;
			}

			// Validate command - only allow safe commands
			// Use strict matching on first token to prevent injection via semicolons/pipes
			const allowedCommands = ["doctor", "version", "config", "help"];
			const tokens = command.trim().split(/\s+/);
			const firstToken = tokens[0];

			if (!firstToken || !allowedCommands.includes(firstToken)) {
				sendError(res, "Command not allowed", 403);
				return;
			}

			// Additional safety: reject if command contains shell operators
			if (/[;&|`$()]/.test(command)) {
				sendError(res, "Invalid characters in command", 403);
				return;
			}

			const result = await executeCcsCommand(command);

			if (result.success) {
				sendResponse(res, { output: result.output });
			} else {
				sendError(res, result.error || "Command execution failed");
			}
		} catch (error) {
			logger.error(`API error [POST /api/actions/ccs]: ${error}`);
			sendError(res, error instanceof Error ? error.message : "Unknown error");
		}
	});

	// ==================== Health ====================

	/**
	 * GET /api/health/:projectId - Get health status for a project
	 * projectId is optional - if not provided, uses cwd
	 */
	app.get("/api/health/:projectId?", async (req: Request, res: Response) => {
		try {
			const { projectId } = req.params;

			let projectPath: string | undefined;
			if (projectId) {
				try {
					projectPath = Buffer.from(projectId, "base64").toString("utf-8");
				} catch {
					projectPath = decodeURIComponent(projectId);
				}
			}

			const health = await checkHealth(projectPath);
			sendResponse(res, health);
		} catch (error) {
			logger.error(`API error [GET /api/health]: ${error}`);
			sendError(res, error instanceof Error ? error.message : "Unknown error");
		}
	});
}
