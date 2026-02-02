/**
 * Type definitions for CK Swarm patch engine
 */

/**
 * State of the swarm mode gate function
 */
export type SwarmModeState = "enabled" | "disabled" | "unknown";

/**
 * Persistent state for swarm patch tracking
 */
export interface SwarmState {
	/** Whether swarm mode is currently enabled */
	enabled: boolean;
	/** Absolute path to the patched cli.js file */
	cliJsPath: string;
	/** SHA-256 hash of the patched cli.js file */
	cliJsHash: string;
	/** Absolute path to the backup file */
	backupPath: string;
	/** Claude Code version when patch was applied */
	ccVersion: string;
	/** ISO timestamp when patch was applied */
	patchedAt: string;
}

/**
 * Result from CLI locator search
 */
export interface LocatorResult {
	/** Absolute path to the cli.js file */
	path: string;
	/** Method used to locate the file */
	method: "global-npm" | "npx-cache" | "local" | "which-claude";
	/** Claude Code version found */
	version: string;
}
