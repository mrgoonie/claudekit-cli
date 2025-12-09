/**
 * Common/shared types used across multiple domains
 */

// Archive types
export type ArchiveType = "tar.gz" | "zip";

// Download progress
export interface DownloadProgress {
	total: number;
	current: number;
	percentage: number;
}

// Authentication method (only gh-cli is supported)
export type AuthMethod = "gh-cli";

// Dependency management types
export type DependencyName = "claude" | "python" | "nodejs" | "pip";

export interface DependencyStatus {
	name: string;
	installed: boolean;
	version?: string;
	path?: string;
	minVersion?: string;
	meetsRequirements: boolean;
	message?: string;
}

export interface DependencyConfig {
	name: DependencyName;
	commands: string[];
	versionFlag: string;
	versionRegex: RegExp;
	minVersion?: string;
	required: boolean;
}

export interface InstallationMethod {
	name: string;
	command: string;
	requiresSudo: boolean;
	platform: "darwin" | "linux" | "win32";
	priority: number;
	description?: string;
}

export interface InstallResult {
	success: boolean;
	message: string;
	installedVersion?: string;
}
