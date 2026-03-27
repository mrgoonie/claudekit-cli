/**
 * State cleanup utilities — TTL expiration and stale issue cleanup for watch state
 * Handles migration from legacy number[] to timestamped ProcessedIssueEntry objects
 */

import type { ProcessedIssueEntry, WatchState } from "../types.js";

/**
 * Migrate legacy number[] entries to timestamped objects.
 * Numbers get `processedAt: now` (fresh TTL window on first upgrade).
 */
export function migrateProcessedIssues(
	issues: (number | ProcessedIssueEntry)[],
): ProcessedIssueEntry[] {
	return issues.map((entry) =>
		typeof entry === "number"
			? { issueNumber: entry, processedAt: new Date().toISOString() }
			: entry,
	);
}

/**
 * Check if an issue number exists in a mixed processedIssues array.
 * Handles both legacy number entries and timestamped object entries.
 */
export function isProcessed(
	issues: (number | ProcessedIssueEntry)[],
	issueNumber: number,
): boolean {
	return issues.some((e) =>
		typeof e === "number" ? e === issueNumber : e.issueNumber === issueNumber,
	);
}

/**
 * Remove an issue from the processedIssues array (for re-enrollment).
 * Works with mixed number/object arrays.
 */
export function removeFromProcessed(
	issues: (number | ProcessedIssueEntry)[],
	issueNumber: number,
): (number | ProcessedIssueEntry)[] {
	return issues.filter((e) =>
		typeof e === "number" ? e !== issueNumber : e.issueNumber !== issueNumber,
	);
}

/**
 * Clean expired issues from state (mutates state in-place):
 * 1. Migrate legacy number entries to timestamped ProcessedIssueEntry objects
 * 2. Remove processedIssues older than TTL
 * 3. Move stale error/timeout activeIssues (>24h) to processedIssues
 */
export function cleanExpiredIssues(state: WatchState, ttlDays: number): void {
	const STALE_ACTIVE_MS = 24 * 60 * 60 * 1000;
	const ttlMs = ttlDays * 86400_000;
	const now = Date.now();

	// Step 1: migrate legacy numbers to timestamped objects
	const migrated = migrateProcessedIssues(state.processedIssues);

	// Step 2: remove entries older than TTL
	state.processedIssues = migrated.filter((e) => now - Date.parse(e.processedAt) < ttlMs);

	// Step 3: move stale error/timeout activeIssues to processedIssues
	for (const [numStr, issueState] of Object.entries(state.activeIssues)) {
		if (
			(issueState.status === "error" || issueState.status === "timeout") &&
			now - Date.parse(issueState.createdAt) > STALE_ACTIVE_MS
		) {
			state.processedIssues.push({
				issueNumber: Number(numStr),
				processedAt: new Date().toISOString(),
			});
			delete state.activeIssues[numStr];
		}
	}
}
