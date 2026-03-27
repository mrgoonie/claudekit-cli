/**
 * Cache manager for project documentation context.
 * Stores Claude-generated summaries in ~/.claudekit/cache/ with 24h TTL.
 * Cache is invalidated when source doc files change (mtime-based hash).
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContextCache {
	createdAt: string;
	docsSummary: string;
	brandSummary: string;
	stylesSummary: string;
	readmeSummary: string;
	sourceHash: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CACHE_DIR = join(homedir(), ".claudekit", "cache");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load cached context for a repo. Returns null if cache is missing, expired,
 * or source files have changed since last summary.
 */
export function getCachedContext(repoPath: string): ContextCache | null {
	const cachePath = getCacheFilePath(repoPath);
	if (!existsSync(cachePath)) return null;

	try {
		const raw = readFileSync(cachePath, "utf-8");
		const cache = JSON.parse(raw) as ContextCache;

		// TTL check
		const age = Date.now() - new Date(cache.createdAt).getTime();
		if (age >= CACHE_TTL_MS) return null;

		// Source file change check
		const currentHash = computeSourceHash(repoPath);
		if (currentHash !== cache.sourceHash) return null;

		return cache;
	} catch {
		return null;
	}
}

/** Persist context cache to disk. Uses atomic write (tmp→rename). */
export async function saveCachedContext(repoPath: string, cache: ContextCache): Promise<void> {
	if (!existsSync(CACHE_DIR)) {
		mkdirSync(CACHE_DIR, { recursive: true });
	}
	const cachePath = getCacheFilePath(repoPath);
	const tmpPath = `${cachePath}.tmp`;
	await writeFile(tmpPath, JSON.stringify(cache, null, 2), "utf-8");
	await rename(tmpPath, cachePath);
}

/**
 * Compute a hash of all doc source file mtimes.
 * Any file modification invalidates the cache.
 */
export function computeSourceHash(repoPath: string): string {
	const hash = createHash("sha256");
	const paths = getDocSourcePaths(repoPath);

	for (const filePath of paths) {
		try {
			const stat = statSync(filePath);
			hash.update(`${filePath}:${stat.mtimeMs}`);
		} catch {
			// File may have been deleted — include path with 0 mtime
			hash.update(`${filePath}:0`);
		}
	}

	return hash.digest("hex").slice(0, 16); // Short hash is sufficient
}

/**
 * Collect all doc source file paths that contribute to context:
 * docs/*.md, README.md, docs/brand-guidelines.md, assets/writing-styles/*
 */
export function getDocSourcePaths(repoPath: string): string[] {
	const paths: string[] = [];

	// docs/*.md
	const docsDir = join(repoPath, "docs");
	if (existsSync(docsDir)) {
		try {
			const files = readdirSync(docsDir);
			for (const f of files) {
				if (f.endsWith(".md")) paths.push(join(docsDir, f));
			}
		} catch {}
	}

	// README.md
	const readme = join(repoPath, "README.md");
	if (existsSync(readme)) paths.push(readme);

	// assets/writing-styles/*
	const stylesDir = join(repoPath, "assets", "writing-styles");
	if (existsSync(stylesDir)) {
		try {
			const files = readdirSync(stylesDir);
			for (const f of files) {
				paths.push(join(stylesDir, f));
			}
		} catch {}
	}

	return paths.sort(); // Stable ordering for hash consistency
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Build cache file path from repo name + path hash, stored in ~/.claudekit/cache/. */
function getCacheFilePath(repoPath: string): string {
	const repoName = basename(repoPath).replace(/[^a-zA-Z0-9_-]/g, "_");
	// Include path hash to avoid collisions between repos with the same directory name
	const pathHash = createHash("sha256").update(repoPath).digest("hex").slice(0, 8);
	return join(CACHE_DIR, `${repoName}-${pathHash}-context-cache.json`);
}
