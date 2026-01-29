/**
 * Process locking utilities to prevent concurrent operations
 * Uses proper-lockfile for cross-process locking
 * Includes global cleanup handlers for signal/exit safety
 */

import { mkdir } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import lockfile from "proper-lockfile";

/**
 * Lock configuration
 */
const LOCK_CONFIG = {
	stale: 60000, // 1 minute — faster recovery from orphaned locks
	retries: 0, // Fail immediately if locked
};

/**
 * Global registry of active locks for cleanup on unexpected exit
 */
const activeLocks = new Map<string, () => Promise<void>>();
let cleanupRegistered = false;

/**
 * Register global signal handlers to release locks on process exit.
 * Only registers once regardless of how many locks are created.
 */
function registerCleanupHandlers(): void {
	if (cleanupRegistered) return;
	cleanupRegistered = true;

	const cleanup = () => {
		// Synchronous best-effort: unlock via proper-lockfile's sync API
		for (const [name] of activeLocks.entries()) {
			try {
				const lockPath = join(getLocksDir(), `${name}.lock`);
				lockfile.unlockSync(lockPath, { realpath: false });
			} catch {
				// Best effort — lock will become stale after timeout
			}
		}
		activeLocks.clear();
	};

	// 'exit' event is synchronous-only, use unlockSync
	process.on("exit", cleanup);
}

/**
 * Get locks directory path
 */
function getLocksDir(): string {
	return join(os.homedir(), ".claudekit", "locks");
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
		activeLocks.set(lockName, release);
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
			await release();
			activeLocks.delete(lockName);
		}
	}
}
