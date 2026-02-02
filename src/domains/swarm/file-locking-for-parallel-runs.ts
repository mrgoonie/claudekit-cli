/**
 * Simple file locking for swarm operations
 * Prevents race conditions in parallel runs
 */

import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PathResolver } from "@/shared/path-resolver.js";

const LOCK_TIMEOUT_MS = 30000; // 30 seconds
const LOCK_CHECK_INTERVAL_MS = 100;

function getLockPath(name: string): string {
	return join(PathResolver.getGlobalKitDir(), `.ck-swarm-${name}.lock`);
}

/**
 * Acquire a named lock, waiting if already held
 */
export async function acquireLock(name: string): Promise<void> {
	const lockPath = getLockPath(name);
	const startTime = Date.now();

	while (existsSync(lockPath)) {
		if (Date.now() - startTime > LOCK_TIMEOUT_MS) {
			// Stale lock - remove and continue
			try {
				unlinkSync(lockPath);
			} catch {}
			break;
		}
		await new Promise((r) => setTimeout(r, LOCK_CHECK_INTERVAL_MS));
	}

	mkdirSync(dirname(lockPath), { recursive: true });
	writeFileSync(lockPath, `${process.pid}:${Date.now()}`, "utf-8");
}

/**
 * Release a named lock
 */
export function releaseLock(name: string): void {
	const lockPath = getLockPath(name);
	if (existsSync(lockPath)) {
		try {
			unlinkSync(lockPath);
		} catch {}
	}
}

/**
 * Execute function with lock protection
 */
export async function withLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
	await acquireLock(name);
	try {
		return await fn();
	} finally {
		releaseLock(name);
	}
}
