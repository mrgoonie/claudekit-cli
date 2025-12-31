/**
 * Settings JSON structure types
 */
export interface HookEntry {
	type: string;
	command: string;
	matcher?: string;
	timeout?: number;
	/**
	 * Kit that added this hook (e.g., "engineer", "marketing")
	 * Used internally for merge tracking and kit-scoped uninstall
	 */
	_origin?: string;
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

/** Conflict resolution info for hooks */
export interface HookConflictInfo {
	command: string;
	incomingKit: string;
	existingKit: string;
	winner: string;
	reason: "newer" | "existing-newer" | "tie" | "no-timestamps";
}

/** Conflict resolution info for MCP servers */
export interface McpConflictInfo {
	serverName: string;
	incomingKit: string;
	existingKit: string;
	winner: string;
	reason: "newer" | "existing-newer" | "tie" | "no-timestamps";
}

export interface MergeResult {
	merged: SettingsJson;
	hooksAdded: number;
	hooksPreserved: number;
	hooksSkipped: number; // Hooks skipped because user removed them
	mcpServersPreserved: number;
	mcpServersSkipped: number; // Servers skipped because user removed them
	mcpServersOverwritten?: number; // Servers overwritten due to timestamp comparison
	conflictsDetected: string[];
	// Track what was actually installed (for persistence)
	newlyInstalledHooks: string[];
	newlyInstalledServers: string[];
	/** Hooks by origin kit for kit-scoped uninstall tracking */
	hooksByOrigin: Map<string, string[]>; // kit → command[]
	/** Conflict resolution tracking for summary display */
	hookConflicts?: HookConflictInfo[];
	mcpConflicts?: McpConflictInfo[];
}

// Options for merge operations
export interface MergeOptions {
	// Previously installed settings (for respecting user deletions)
	installedSettings?: {
		hooks?: string[];
		mcpServers?: string[];
		hookTimestamps?: Record<string, string>;
		mcpServerTimestamps?: Record<string, string>;
	};
	/** Kit that owns the source settings (for origin tracking) */
	sourceKit?: string;
	/** Timestamps for incoming hooks/servers (for conflict resolution) */
	sourceTimestamps?: {
		hooks?: Record<string, string>;
		mcpServers?: Record<string, string>;
	};
}
