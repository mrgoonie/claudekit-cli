export interface MigrationCapabilities {
	agents: boolean;
	commands: boolean;
	skills: boolean;
	config: boolean;
	rules: boolean;
	hooks: boolean;
}

export interface MigrationProviderInfo {
	name: string;
	displayName: string;
	detected: boolean;
	recommended: boolean;
	commandsGlobalOnly: boolean;
	capabilities: MigrationCapabilities;
}

export interface MigrationDiscovery {
	sourcePaths: {
		agents: string | null;
		commands: string | null;
		skills: string | null;
		hooks: string | null;
	};
	counts: {
		agents: number;
		commands: number;
		skills: number;
		config: number;
		rules: number;
		hooks: number;
	};
	items: {
		agents: string[];
		commands: string[];
		skills: string[];
		config: string[];
		rules: string[];
		hooks: string[];
	};
}

export interface MigrationIncludeOptions {
	agents: boolean;
	commands: boolean;
	skills: boolean;
	config: boolean;
	rules: boolean;
	hooks: boolean;
}

export interface MigrationResultEntry {
	provider: string;
	providerDisplayName: string;
	success: boolean;
	path: string;
	error?: string;
	overwritten?: boolean;
	skipped?: boolean;
	skipReason?: string;
	warnings?: string[];
	/** Portable type category (agent/command/skill/config/rules/hooks) */
	portableType?: "agent" | "command" | "skill" | "config" | "rules" | "hooks" | "unknown";
	/** Item identifier (e.g., "scout", "add-command") */
	itemName?: string;
}

export interface MigrationExecutionResponse {
	results: MigrationResultEntry[];
	warnings: string[];
	effectiveGlobal: boolean;
	counts: {
		installed: number;
		skipped: number;
		failed: number;
	};
	discovery: {
		agents: number;
		commands: number;
		skills: number;
		config: number;
		rules: number;
		hooks: number;
	};
	unsupportedByType: {
		agents: string[];
		commands: string[];
		skills: string[];
		config: string[];
		rules: string[];
		hooks: string[];
	};
}
