/**
 * Sync domain types
 */
import type { TrackedFile } from "@/types";

/**
 * Result of checking for config updates
 */
export interface UpdateCheckResult {
	hasUpdates: boolean;
	currentVersion: string;
	latestVersion: string;
	/** True if using cached result */
	fromCache: boolean;
}

/**
 * Cached update check data
 */
export interface ConfigUpdateCache {
	lastCheck: number; // Unix timestamp (ms)
	latestVersion: string;
	etag?: string; // GitHub ETag for conditional requests
}

/**
 * Plan for sync operation - categorizes files by action needed
 */
export interface SyncPlan {
	/** Files unchanged by user → silent auto-update */
	autoUpdate: TrackedFile[];
	/** Files modified by user → interactive merge */
	needsReview: TrackedFile[];
	/** User-owned files → skip (never touch) */
	skipped: TrackedFile[];
}

/**
 * A single diff hunk from jsdiff
 */
export interface FileHunk {
	oldStart: number;
	oldLines: number;
	newStart: number;
	newLines: number;
	/** Lines with +/-/space prefix */
	lines: string[];
}

/**
 * Result of interactive merge for a single file
 */
export interface MergeResult {
	/** Merged content */
	result: string;
	/** Number of hunks applied */
	applied: number;
	/** Number of hunks rejected */
	rejected: number;
}
