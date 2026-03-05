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
			// Best effort — lock will become stale after timeout.
			// Wrap logger call since it may throw during process exit.
			try {
				logger.verbose(`Failed to cleanup lock: ${name}`);
			} catch {
				// Logger itself failed — nothing more we can do
			}
		}
	}
	activeLocks.clear();
}

/**
 * Register global exit handler to release locks on process termination.
 * Only registers once regardless of how many locks are created.
 *
 * Uses only 'exit' event (not SIGINT/SIGTERM) because:
 * - 'exit' fires for ALL termination paths including process.exit(), signals, natural drain
 * - Avoids handler ordering conflicts with index.ts and logger.ts signal handlers
 * - index.ts SIGINT/SIGTERM set exitCode without process.exit(), allowing finally blocks to run
 * - logger.ts SIGINT/SIGTERM call process.exit() which triggers 'exit' event → cleanup runs
 */
function registerCleanupHandlers(): void {
	if (cleanupRegistered) return;
	cleanupRegistered = true;

	// 'exit' event is synchronous-only — covers all termination paths
	process.on("exit", cleanupLocks);
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
		if (release) {
			// Keep lockName in registry during release() so the exit handler can
			// clean up via unlockSync if the process terminates mid-release.
			// A redundant unlockSync after release() completes is harmless (caught by try/catch).
			await release();
		}
		activeLocks.delete(lockName);
	}
}
