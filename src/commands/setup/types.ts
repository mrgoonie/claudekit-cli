/**
 * Setup command types and context
 */

export interface SetupOptions {
	global: boolean;
	skipPackages: boolean;
	dir?: string;
}

export interface SetupContext {
	targetDir: string;
	options: SetupOptions;
	cancelled: boolean;
	envConfigured: boolean;
	packagesInstalled: string[];
	selectedKit?: "engineer" | "marketing";
}
