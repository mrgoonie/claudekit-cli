/**
 * Settings JSON structure types
 */
export interface HookEntry {
	type: string;
	command: string;
	matcher?: string;
	timeout?: number;
}

export interface HookConfig {
	matcher?: string;
	hooks?: HookEntry[];
}

export interface McpServerConfig {
	command?: string;
	args?: string[];
	env?: Record<string, string>;
	url?: string;
	[key: string]: unknown;
}

export interface SettingsJson {
	hooks?: Record<string, HookConfig[] | HookEntry[]>;
	mcp?: {
		servers?: Record<string, McpServerConfig>;
		[key: string]: unknown;
	};
	[key: string]: unknown;
}

export interface MergeResult {
	merged: SettingsJson;
	hooksAdded: number;
	hooksPreserved: number;
	mcpServersPreserved: number;
	conflictsDetected: string[];
}
