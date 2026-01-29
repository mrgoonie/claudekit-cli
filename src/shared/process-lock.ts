/**
 * Process locking utilities to prevent concurrent operations
 * Uses proper-lockfile for cross-process locking
 * Includes global cleanup handlers for signal/exit safety
 */

import { mkdir } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import lockfile from "proper-lockfile";
import { logger } from "./logger.js";

/**
 * Lock configuration
 */
const LOCK_CONFIG = {
	stale: 60000, // 1 minute — faster recovery from orphaned locks
	retries: 0, // Fail immediately if locked
};

/**
 * Global registry of active lock names for cleanup on unexpected exit.
 * Uses Set<string> since cleanup uses unlockSync with lock paths, not release functions.
 */
const activeLocks = new Set<string>();
let cleanupRegistered = false;

/**
 * Get locks directory path
 */
function getLocksDir(): string {
	return join(os.homedir(), ".claudekit", "locks");
}

/**
 * Synchronously release all active locks. Called from process exit/signal handlers.
 * Best-effort: swallows errors since the process is terminating anyway.
 */
function cleanupLocks(): void {
	for (const name of activeLocks) {
		try {
			const lockPath = join(getLocksDir(), `${name}.lock`);
			lockfile.unlockSync(lockPath, { realpath: false });
		} catch {
			// Best effort — lock will become stale after timeout
			logger.verbose(`Failed to cleanup lock: ${name}`);
		}
	}
	activeLocks.clear();
}

/**
 * Register global exit and signal handlers to release locks on process termination.
 * Only registers once regardless of how many locks are created.
 *
 * Handlers:
 * - 'exit': fires for all exit paths (process.exit, signals, natural drain)
 * - SIGINT/SIGTERM: explicit signal cleanup before index.ts handlers run
 *
 * Note: index.ts already has SIGINT/SIGTERM handlers that set exitCode without
 * calling process.exit(), allowing finally blocks to run. These handlers add
 * a synchronous safety net for cases where finally blocks can't execute
 * (e.g., subprocess killed by parent timeout).
 */
function registerCleanupHandlers(): void {
	if (cleanupRegistered) return;
	cleanupRegistered = true;

	// 'exit' event is synchronous-only — covers all termination paths
	process.on("exit", cleanupLocks);

	// Explicit signal handlers for cleanup before process terminates.
	// These run in addition to existing handlers in index.ts and logger.ts.
	// Don't call process.exit() here — let existing handlers control exit behavior.
	process.on("SIGINT", cleanupLocks);
	process.on("SIGTERM", cleanupLocks);
}

/**
 * Ensure lock directory exists
 */
async function ensureLocksDir(): Promise<void> {
	const lockDir = getLocksDir();
	await mkdir(lockDir, { recursive: true });
}

/**
 * Execute function with process lock
 *
 * @param lockName Name of the lock file (e.g., 'engineer-install', 'migration')
 * @param fn Function to execute with lock held
 * @returns Result of the function
 * @throws {Error} If lock cannot be acquired or function fails
 */
export async function withProcessLock<T>(lockName: string, fn: () => Promise<T>): Promise<T> {
	registerCleanupHandlers();
	await ensureLocksDir();

	const lockPath = join(getLocksDir(), `${lockName}.lock`);

	let release: (() => Promise<void>) | undefined;

	try {
		release = await lockfile.lock(lockPath, { ...LOCK_CONFIG, realpath: false });
		activeLocks.add(lockName);
		return await fn();
	} catch (e) {
		const error = e as { code?: string };
		if (error.code === "ELOCKED") {
			throw new Error(
				`Another ClaudeKit process is running.\n\nOperation: ${lockName}\nWait for it to complete or remove lock: ${lockPath}`,
			);
		}
		throw e;
	} finally {
		// Remove from registry BEFORE async release to prevent race with signal handlers
		activeLocks.delete(lockName);
		if (release) {
			await release();
		}
	}
}
