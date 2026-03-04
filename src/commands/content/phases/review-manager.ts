/**
 * Hybrid review system for content items.
 * Supports auto, manual, and hybrid review modes.
 * Manual mode sets status to "reviewing" for out-of-band CLI approval.
 */

import type Database from "better-sqlite3";
import type { ContentConfig, ContentItem } from "../types.js";
import type { ContentLogger } from "./content-logger.js";
import { previewContent } from "./content-previewer.js";
import { insertTaskLog, updateContentStatus } from "./db-queries.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReviewDecision {
	approved: boolean;
	reason?: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Review content based on configured mode. Returns approval decision. */
export async function reviewContent(
	content: ContentItem,
	config: ContentConfig,
	db: Database.Database,
	contentLogger: ContentLogger,
): Promise<ReviewDecision> {
	switch (config.reviewMode) {
		case "auto":
			return { approved: true };

		case "manual":
			return manualReview(content, db, contentLogger);

		case "hybrid":
			// Hybrid: auto-approve but log for visibility
			contentLogger.info(`[hybrid] Auto-approving content ${content.id} for ${content.platform}`);
			return { approved: true };

		default:
			return { approved: true };
	}
}

/**
 * Approve a content item by ID.
 * Transitions status from "reviewing" → "scheduled".
 * Called by the `ck content approve <id>` subcommand.
 */
export function approveContent(db: Database.Database, contentId: number): void {
	updateContentStatus(db, contentId, "scheduled");
}

/**
 * Reject a content item by ID.
 * Transitions status back to "draft" and optionally logs the reason.
 */
export function rejectContent(db: Database.Database, contentId: number, reason?: string): void {
	updateContentStatus(db, contentId, "draft");

	if (reason) {
		insertTaskLog(db, {
			taskType: "review_rejection",
			status: "completed",
			details: `id=${contentId}: ${reason}`,
			durationMs: null,
		});
	}
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Manual review — preview content in terminal, then park it in "reviewing"
 * state. The daemon cannot prompt interactively, so approval happens via
 * a separate `ck content approve <id>` CLI invocation.
 */
async function manualReview(
	content: ContentItem,
	db: Database.Database,
	contentLogger: ContentLogger,
): Promise<ReviewDecision> {
	previewContent(content);
	updateContentStatus(db, content.id, "reviewing");
	contentLogger.info(
		`Content ${content.id} queued for manual review. Use 'ck content approve ${content.id}' to approve.`,
	);
	return { approved: false, reason: "Awaiting manual approval" };
}
