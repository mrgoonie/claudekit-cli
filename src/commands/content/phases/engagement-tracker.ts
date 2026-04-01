/**
 * Engagement tracking for published content.
 * Fetches metrics from platform adapters and stores historical snapshots.
 * Multiple rows per publication are allowed — each run appends a new snapshot.
 */

import type { ContentConfig } from "../types.js";
import type { ContentLogger } from "./content-logger.js";
import type { PlatformAdapter } from "./platform-adapters/adapter-interface.js";
import type { Database } from "./sqlite-client.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrackingResult {
	postsTracked: number;
	totalEngagement: number;
}

interface RawPublication {
	id: number;
	content_item_id: number;
	platform: string;
	post_id: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch and store engagement metrics for publications from the last 7 days.
 * Appends a new snapshot row each run (historical tracking, not upsert).
 */
export async function trackEngagement(
	db: Database,
	adapters: Map<string, PlatformAdapter>,
	config: ContentConfig,
	contentLogger: ContentLogger,
): Promise<TrackingResult> {
	let postsTracked = 0;
	let totalEngagement = 0;

	// Only track if self-improvement is enabled
	if (!config.selfImprovement.enabled) {
		return { postsTracked, totalEngagement };
	}

	const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
	const publications = db
		.prepare(
			"SELECT id, content_item_id, platform, post_id FROM publications WHERE published_at > ?",
		)
		.all(sevenDaysAgo) as RawPublication[];

	for (const pub of publications) {
		const adapterKey = pub.platform === "x_thread" ? "x" : pub.platform;
		const adapter = adapters.get(adapterKey);
		if (!adapter) continue;

		try {
			const engagement = await adapter.getEngagement(pub.post_id);

			// Insert a new snapshot row — historical tracking, not upsert
			db.prepare(
				`INSERT INTO engagement_metrics
					(publication_id, likes, shares, comments, impressions)
				 VALUES (?, ?, ?, ?, ?)`,
			).run(
				pub.id,
				engagement.likes,
				engagement.shares,
				engagement.comments,
				engagement.impressions,
			);

			postsTracked++;
			totalEngagement += engagement.likes + engagement.shares * 3 + engagement.comments * 2;
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			contentLogger.debug(`Failed to track engagement for pub ${pub.id}: ${msg}`);
		}
	}

	contentLogger.info(
		`Tracked engagement for ${postsTracked} posts. Total score: ${totalEngagement}`,
	);
	return { postsTracked, totalEngagement };
}

/**
 * Returns true when enough time has elapsed since the last engagement check.
 * Pass null for lastCheckAt to force an immediate check.
 */
export function shouldCheckEngagement(lastCheckAt: string | null, intervalHours: number): boolean {
	if (!lastCheckAt) return true;
	const lastCheck = new Date(lastCheckAt).getTime();
	return Date.now() - lastCheck >= intervalHours * 60 * 60 * 1000;
}
