import { exec } from "node:child_process";
import { promisify } from "node:util";

export const execAsync = promisify(exec);

/**
 * Supported package managers
 */
export type PackageManager = "npm" | "bun" | "yarn" | "pnpm" | "unknown";

/**
 * Cache structure for storing detected package manager
 */
export interface InstallInfo {
	packageManager: PackageManager;
	detectedAt: number; // timestamp in ms
	version?: string; // PM version at detection time
}

/**
 * Query configuration for package manager detection
 */
export interface PmQuery {
	pm: PackageManager;
	cmd: string;
	checkFn: (stdout: string) => boolean;
}

/**
 * Validate npm package name to prevent shell injection
 * @see https://github.com/npm/validate-npm-package-name
 */
export function isValidPackageName(name: string): boolean {
	// npm package name: optional @scope/ prefix, followed by alphanumeric with .-_
	return /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name);
}

/**
 * Validate semver version string
 */
export function isValidVersion(version: string): boolean {
	// Allow semver, ranges, and tags (latest, beta, etc.)
	return /^[a-zA-Z0-9._-]+$/.test(version);
}
