/**
 * Route registration
 */

import type { Express } from "express";
import { registerConfigRoutes } from "./config-routes.js";
import { registerHealthRoutes } from "./health-routes.js";
import { registerProjectRoutes } from "./project-routes.js";

export function registerRoutes(app: Express): void {
	registerHealthRoutes(app);
	registerConfigRoutes(app);
	registerProjectRoutes(app);
}
