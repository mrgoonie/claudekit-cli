/**
 * Static file server for production UI
 */

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "@/shared/logger.js";
import express, { type Express, type NextFunction, type Request, type Response } from "express";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function serveStatic(app: Express): void {
	// Resolve UI dist directory relative to this file
	// In built package: dist/index.js -> dist/ui/
	const uiDistPath = join(__dirname, "..", "..", "ui");

	if (!existsSync(uiDistPath)) {
		logger.warning(`UI dist not found at ${uiDistPath}. Run 'bun run ui:build' first.`);
		// Use middleware instead of catch-all route for Express 5 compatibility
		app.use((req: Request, res: Response, next: NextFunction) => {
			if (req.path.startsWith("/api/")) {
				return next();
			}
			res.status(503).json({
				error: "Dashboard not built",
				message: "Run 'bun run ui:build' to build the dashboard",
			});
		});
		return;
	}

	// Serve static files
	app.use(express.static(uiDistPath));

	// SPA fallback - serve index.html for non-API routes using middleware
	app.use((req: Request, res: Response, next: NextFunction) => {
		if (req.path.startsWith("/api/") || req.path.startsWith("/ws")) {
			return next();
		}
		res.sendFile(join(uiDistPath, "index.html"));
	});

	logger.debug(`Serving static files from ${uiDistPath}`);
}
