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
 * Lock duration presets — short-lived commands vs long-running daemons.
 * "short": 1-min stale (install, migrate) — fast recovery from orphaned locks.
 * "long": 5-min stale (ck watch) — tolerates Windows/Bun timer drift and NTFS latency.
 */
export type LockDuration = "short" | "long";

const LOCK_CONFIGS: Record<LockDuration, { stale: number; retries: number }> = {
	short: { stale: 60_000, retries: 0 },
	long: { stale: 300_000, retries: 0 },
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
			lockfile.unlockSync(getLockPaths(name).resource, { realpath: false });
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
 * Get both the resource path and the lockfile directory path for a lock name.
 * proper-lockfile creates a directory at `<path>.lock` to hold the actual lock,
 * so for lockPath "ck-watch.lock" the real lock artifact is "ck-watch.lock.lock".
 */
export function getLockPaths(lockName: string): { resource: string; lockfile: string } {
	const resource = join(getLocksDir(), `${lockName}.lock`);
	return { resource, lockfile: `${resource}.lock` };
}

/**
 * Execute function with process lock
 *
 * @param lockName Name of the lock file (e.g., 'engineer-install', 'migration')
 * @param fn Function to execute with lock held
 * @param duration Lock duration preset — "short" (default) or "long" for daemons like ck watch
 * @returns Result of the function
 * @throws {Error} If lock cannot be acquired or function fails
 */
export async function withProcessLock<T>(
	lockName: string,
	fn: () => Promise<T>,
	duration: LockDuration = "short",
): Promise<T> {
	registerCleanupHandlers();
	await ensureLocksDir();

	const { resource: lockPath } = getLockPaths(lockName);
	const config = LOCK_CONFIGS[duration];

	let release: (() => Promise<void>) | undefined;

	try {
		release = await lockfile.lock(lockPath, {
			...config,
			realpath: false,
			// For long-running commands, log compromise instead of crashing.
			// proper-lockfile calls this when the lock's mtime refresh fails
			// (e.g., Windows timer drift, NTFS latency, busy event loop).
			onCompromised:
				duration === "long"
					? (err: Error) => {
							logger.warning(`Lock "${lockName}" compromised: ${err.message}. Continuing...`);
						}
					: undefined,
		});
		activeLocks.add(lockName);
		return await fn();
	} catch (e) {
		const error = e as { code?: string };
		if (error.code === "ELOCKED") {
			throw new Error(
				`Another ClaudeKit process is running.\n\nOperation: ${lockName}\nWait for it to complete or remove lock: ${lockPath}`,
			);
		}
		if (error.code === "ECOMPROMISED") {
			throw new Error(
				`Lock was compromised (stale or externally removed).\n\nOperation: ${lockName}\nUse --force to clear and restart.`,
			);
		}
		throw e;
	} finally {
		if (release) {
			try {
				await release();
			} catch (releaseErr) {
				// After onCompromised fires, proper-lockfile marks the lock as released internally.
				// Calling release() then rejects with ERELEASED — expected and safe to ignore.
				const code = (releaseErr as { code?: string }).code;
				if (code !== "ERELEASED") {
					logger.warning(`Failed to release lock "${lockName}": ${(releaseErr as Error).message}`);
				}
			}
		}
		activeLocks.delete(lockName);
	}
}
