/**
 * Process locking utilities to prevent concurrent operations
 * Uses proper-lockfile for cross-process locking
 */

import { mkdir } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import lockfile from "proper-lockfile";

/**
 * Lock configuration
 */
const LOCK_CONFIG = {
	stale: 300000, // 5 minutes (300000ms)
	retries: 0, // Fail immediately if locked
};

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
	await ensureLocksDir();

	const lockPath = join(getLocksDir(), `${lockName}.lock`);

	let release: (() => Promise<void>) | undefined;

	try {
		release = await lockfile.lock(lockPath, { ...LOCK_CONFIG, realpath: false });
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
		}
	}
}
