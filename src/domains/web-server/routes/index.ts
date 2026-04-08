/**
 * Route registration
 */

import type { Express } from "express";
import { registerActionRoutes } from "./action-routes.js";
import { registerAgentsBrowserRoutes } from "./agents-routes.js";
import { registerCkConfigRoutes } from "./ck-config-routes.js";
import { registerCommandRoutes } from "./command-routes.js";
import { registerDashboardRoutes } from "./dashboard-routes.js";
import { registerHealthRoutes } from "./health-routes.js";
import { registerHookLogRoutes } from "./hook-log-routes.js";
import { registerMcpRoutes } from "./mcp-routes.js";
import { registerMigrationRoutes } from "./migration-routes.js";
import { registerPlanRoutes } from "./plan-routes.js";
import { registerProjectRoutes } from "./project-routes.js";
import { registerSessionRoutes } from "./session-routes.js";
import { registerSettingsRoutes } from "./settings-routes.js";
import { registerSkillBrowserRoutes } from "./skill-browser-routes.js";
import { registerSkillRoutes } from "./skill-routes.js";
import { registerSystemRoutes } from "./system-routes.js";
import { registerUserRoutes } from "./user-routes.js";

export function registerRoutes(app: Express): void {
	registerHealthRoutes(app);
	registerHookLogRoutes(app);
	registerActionRoutes(app);
	registerAgentsBrowserRoutes(app);
	registerCkConfigRoutes(app);
	registerCommandRoutes(app);
	registerDashboardRoutes(app);
	registerMcpRoutes(app);
	registerMigrationRoutes(app);
	registerPlanRoutes(app);
	registerProjectRoutes(app);
	registerSkillRoutes(app);
	registerSkillBrowserRoutes(app);
	registerSessionRoutes(app);
	registerSettingsRoutes(app);
	registerSystemRoutes(app);
	registerUserRoutes(app);
}
