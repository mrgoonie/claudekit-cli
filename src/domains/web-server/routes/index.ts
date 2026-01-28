/**
 * Route registration
 */

import type { Express } from "express";
import { registerCkConfigRoutes } from "./ck-config-routes.js";
import { registerConfigRoutes } from "./config-routes.js";
import { registerHealthRoutes } from "./health-routes.js";
import { registerProjectRoutes } from "./project-routes.js";
import { registerSessionRoutes } from "./session-routes.js";
import { registerSettingsRoutes } from "./settings-routes.js";
import { registerSkillRoutes } from "./skill-routes.js";
import { registerUserRoutes } from "./user-routes.js";

export function registerRoutes(app: Express): void {
	registerHealthRoutes(app);
	registerConfigRoutes(app);
	registerCkConfigRoutes(app);
	registerProjectRoutes(app);
	registerSkillRoutes(app);
	registerSessionRoutes(app);
	registerSettingsRoutes(app);
	registerUserRoutes(app);
}
