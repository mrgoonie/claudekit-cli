/**
 * Shared path-safety helpers for Codex file writers.
 *
 * Extracted from codex-toml-installer.ts so the same boundary checks and
 * lockfile pattern can be reused by codex-features-flag.ts and
 * codex-hook-wrapper.ts without duplication.
 *
 * Lock coordination: all Codex-directory writes share a single lock keyed on
 * the ~/.codex/ (or project .codex/) directory.  The lock file is
 * `.config.toml.ck-codex.lock` — the same one codex-toml-installer.ts uses —
 * so concurrent runs of any of the three writers serialize correctly.
 */
import { existsSync } from "node:fs";
import { mkdir, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import lockfile from "proper-lockfile";

// ---------------------------------------------------------------------------
// Path boundary helpers
// ---------------------------------------------------------------------------

export function isPathWithinBoundary(targetPath: string, boundaryPath: string): boolean {
	const resolvedTarget = resolve(targetPath);
	const resolvedBoundary = resolve(boundaryPath);
	return (
		resolvedTarget === resolvedBoundary || resolvedTarget.startsWith(`${resolvedBoundary}${sep}`)
	);
}

async function resolveRealPathSafe(path: string): Promise<string> {
	try {
		return await realpath(path);
	} catch {
		// Path doesn't exist yet — resolve symlinks on the parent chain
		return resolve(path);
	}
}

/**
 * Canonical (realpath) boundary check — resolves symlinks before comparing.
 * Prevents following a symlinked target outside the intended boundary.
 */
export async function isCanonicalPathWithinBoundary(
	targetPath: string,
	boundaryPath: string,
): Promise<boolean> {
	const canonicalTarget = await resolveRealPathSafe(targetPath);
	const canonicalBoundary = await resolveRealPathSafe(boundaryPath);
	return isPathWithinBoundary(canonicalTarget, canonicalBoundary);
}

// ---------------------------------------------------------------------------
// Codex directory lock
// ---------------------------------------------------------------------------

/** Returns the canonical lock file path for a given Codex target file. */
function getCodexLockPath(targetFilePath: string): string {
	return join(dirname(resolve(targetFilePath)), ".config.toml.ck-codex.lock");
}

/**
 * Run `operation` while holding the Codex directory lock.
 *
 * All writers under ~/.codex/ (config.toml, hooks.json, hooks/*.cjs wrappers)
 * share this lock so they serialize against each other and against
 * codex-toml-installer.ts which uses the same lock file path.
 */
export async function withCodexTargetLock<T>(
	targetFilePath: string,
	operation: () => Promise<T>,
): Promise<T> {
	const resolvedTargetPath = resolve(targetFilePath);
	const dir = dirname(resolvedTargetPath);

	if (!existsSync(dir)) {
		await mkdir(dir, { recursive: true });
	}

	const release = await lockfile.lock(dir, {
		realpath: false,
		lockfilePath: getCodexLockPath(resolvedTargetPath),
		retries: {
			retries: 10,
			factor: 1.5,
			minTimeout: 25,
			maxTimeout: 500,
		},
	});

	try {
		return await operation();
	} finally {
		try {
			await release();
		} catch {
			// Best-effort lock cleanup; avoid masking operation failures
		}
	}
}

// ---------------------------------------------------------------------------
// Boundary constants
// ---------------------------------------------------------------------------

/** Global Codex directory boundary — all global Codex writes must stay within. */
export function getCodexGlobalBoundary(): string {
	return join(homedir(), ".codex");
}
