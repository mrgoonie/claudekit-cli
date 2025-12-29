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
	hooksSkipped: number; // Hooks skipped because user removed them
	mcpServersPreserved: number;
	mcpServersSkipped: number; // Servers skipped because user removed them
	conflictsDetected: string[];
	// Track what was actually installed (for persistence)
	newlyInstalledHooks: string[];
	newlyInstalledServers: string[];
}

// Options for merge operations
export interface MergeOptions {
	// Previously installed settings (for respecting user deletions)
	installedSettings?: {
		hooks?: string[];
		mcpServers?: string[];
	};
}
