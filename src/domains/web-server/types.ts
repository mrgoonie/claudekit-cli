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
}
