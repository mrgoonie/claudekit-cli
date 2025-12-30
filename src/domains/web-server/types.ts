/**
 * Web server domain types
 */

import type { Server } from "node:http";

export interface ServerOptions {
	port?: number;
	openBrowser?: boolean;
	devMode?: boolean;
}

export interface ServerInstance {
	port: number;
	server: Server;
	close: () => Promise<void>;
}

export interface ConfigResponse {
	global: Record<string, unknown>;
	local: Record<string, unknown> | null;
	merged: Record<string, unknown>;
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
	// History integration fields (optional)
	source?: "session" | "history" | "both";
	interactionCount?: number;
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
}
