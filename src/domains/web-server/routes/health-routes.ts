/**
 * Health check routes
 */

import type { Express, Request, Response } from "express";

/**
 * Stable identifiers for dashboard capability surfaces.
 * Add a new entry here when a new top-level route group is registered.
 * External launchers (e.g. engineer plans-kanban) use these to feature-detect
 * without coupling to a specific CLI version number.
 */
export const DASHBOARD_FEATURES = [
	"plans-dashboard",
	"workflows",
	"migrate",
	"statusline",
	"projects",
	"skills",
	"agents",
	"commands",
	"mcp",
] as const;

export type DashboardFeature = (typeof DASHBOARD_FEATURES)[number];

export function registerHealthRoutes(app: Express): void {
	app.get("/api/health", (_req: Request, res: Response) => {
		res.json({
			status: "ok",
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
			features: DASHBOARD_FEATURES,
		});
	});
}
