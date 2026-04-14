/**
 * Web server domain types
 */

import type { Server } from "node:http";
import type { PlanScope } from "@/domains/plan-parser/plan-types.js";
import type { PlanValidationMode } from "@/types";
import type { ProjectActivePlan } from "./project-plan-data.js";

export interface ServerOptions {
	port?: number;
	openBrowser?: boolean;
	devMode?: boolean;
	host?: string;
}

export interface ServerInstance {
	port: number;
	host: string;
	server: Server;
	close: () => Promise<void>;
}

export interface ProjectInfo {
	id: string;
	name: string;
	path: string;
	hasLocalConfig: boolean;
	kitType: string | null;
	version: string | null;
	// Enhanced fields for dashboard
	health: "healthy" | "warning" | "error" | "unknown";
	model: string;
	activeHooks: number;
	mcpServers: number;
	skills: string[];
	// Registry fields (optional for backward compat)
	pinned?: boolean;
	tags?: string[];
	addedAt?: string;
	lastOpened?: string;
	preferences?: {
		terminalApp?: string;
		editorApp?: string;
	};
	// History integration fields (optional)
	source?: "session" | "history" | "both";
	interactionCount?: number;
	planSettings?: {
		scope: PlanScope;
		plansDir: string;
		validationMode: PlanValidationMode;
		activePlanCount: number;
	};
	activePlans?: ProjectActivePlan[];
}

export interface SkillInfo {
	id: string;
	name: string;
	description: string;
	category: string;
	isAvailable: boolean;
}

export interface SessionInfo {
	id: string;
	timestamp: string;
	duration: string;
	summary: string;
}

export interface SettingsInfo {
	model: string;
	hookCount: number;
	mcpServerCount: number;
	permissions: unknown;
}

export interface AddProjectRequest {
	path: string;
	alias?: string;
	pinned?: boolean;
	tags?: string[];
}

export interface UpdateProjectRequest {
	alias?: string;
	pinned?: boolean;
	tags?: string[];
	preferences?: {
		terminalApp?: string | null;
		editorApp?: string | null;
	} | null;
}
