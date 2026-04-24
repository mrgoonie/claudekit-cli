/**
 * Health check routes
 */

import type { Express, Request, Response } from "express";

/**
 * Stable identifiers for frontend dashboard surfaces (React Router routes in
 * `src/ui/src/router.tsx`). Only surfaces that external launchers or tooling may
 * feature-detect belong here — not every registered route or API group needs
 * an entry. External consumers treat these as opaque strings; renaming a flag
 * is a breaking change.
 *
 * Source of truth for the routes referenced here: `src/ui/src/router.tsx`.
 */
export const DASHBOARD_FEATURES = [
	// `/plans` SPA route. Suffixed `-dashboard` to disambiguate from the plan
	// file concept elsewhere in the CLI; intentionally does not mirror the path.
	"plans-dashboard",
	"workflows",
	"migrate",
	"statusline",
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
