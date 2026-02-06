/**
 * Route registration
 */

import type { Express } from "express";
import { registerActionRoutes } from "./action-routes.js";
import { registerCkConfigRoutes } from "./ck-config-routes.js";
import { registerDoctorRoutes } from "./doctor-routes.js";
import { registerHealthRoutes } from "./health-routes.js";
import { registerKitRoutes } from "./kit-routes.js";
import { registerProjectRoutes } from "./project-routes.js";
import { registerSessionRoutes } from "./session-routes.js";
import { registerSettingsRoutes } from "./settings-routes.js";
import { registerSkillRoutes } from "./skill-routes.js";
import { registerSystemRoutes } from "./system-routes.js";
import { registerUserRoutes } from "./user-routes.js";

export function registerRoutes(app: Express): void {
	registerHealthRoutes(app);
	registerDoctorRoutes(app);
	registerActionRoutes(app);
	registerCkConfigRoutes(app);
	registerKitRoutes(app);
	registerProjectRoutes(app);
	registerSkillRoutes(app);
	registerSessionRoutes(app);
	registerSettingsRoutes(app);
	registerSystemRoutes(app);
	registerUserRoutes(app);
}
