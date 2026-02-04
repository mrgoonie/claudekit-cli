/**
 * Temporary Directory Cleanup
 * Tracks and cleans up temporary directories on process exit
 */
import { rmSync } from "node:fs";
import { remove } from "fs-extra";
import { logger } from "./logger.js";

const tempDirs = new Set<string>();

/**
 * Register a temporary directory for cleanup on exit
 */
export function registerTempDir(dir: string): void {
	tempDirs.add(dir);
	logger.debug(`Registered temp directory for cleanup: ${dir}`);
}

/**
 * Unregister a temporary directory (when manually cleaned)
 */
export function unregisterTempDir(dir: string): void {
	tempDirs.delete(dir);
	logger.debug(`Unregistered temp directory: ${dir}`);
}

/**
 * Clean up all registered temporary directories (async)
 */
async function cleanup(): Promise<void> {
	if (tempDirs.size === 0) return;

	logger.debug(`Cleaning up ${tempDirs.size} temporary director(ies)...`);
	for (const dir of tempDirs) {
		try {
			await remove(dir);
			logger.debug(`Cleaned up temp directory: ${dir}`);
		} catch (error) {
			logger.debug(`Failed to clean temp directory ${dir}: ${error}`);
		}
	}
	tempDirs.clear();
}

/**
 * Clean up all registered temporary directories (sync - for exit handler)
 */
function cleanupSync(): void {
	if (tempDirs.size === 0) return;

	for (const dir of tempDirs) {
		try {
			rmSync(dir, { recursive: true, force: true });
		} catch {
			// Silently ignore errors on exit
		}
	}
	tempDirs.clear();
}

/**
 * Initialize cleanup handlers
 * Should be called once at application startup
 */
export function initCleanupHandlers(): void {
	// SIGINT (Ctrl+C)
	process.on("SIGINT", async () => {
		logger.debug("Received SIGINT, cleaning up...");
		await cleanup();
		process.exit(130); // Standard exit code for SIGINT
	});

	// SIGTERM (kill command)
	process.on("SIGTERM", async () => {
		logger.debug("Received SIGTERM, cleaning up...");
		await cleanup();
		process.exit(143); // Standard exit code for SIGTERM
	});

	// Normal exit
	process.on("exit", () => {
		// Must be synchronous - event loop is stopped
		cleanupSync();
	});

	logger.debug("Cleanup handlers initialized");
}
