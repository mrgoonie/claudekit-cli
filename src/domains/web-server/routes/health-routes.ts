/**
 * Health check routes
 */

import type { Express, Request, Response } from "express";

export function registerHealthRoutes(app: Express): void {
	app.get("/api/health", (_req: Request, res: Response) => {
		res.json({
			status: "ok",
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
		});
	});
}
