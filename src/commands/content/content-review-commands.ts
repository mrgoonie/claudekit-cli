/**
 * Review-related subcommand handlers for `ck content`:
 *   queue   — list pending review items
 *   approve — approve content by ID
 *   reject  — reject content by ID with optional reason
 */

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { logger } from "@/shared/logger.js";
import { previewContent } from "./phases/content-previewer.js";
import { initDatabase } from "./phases/db-manager.js";
import { getContentQueue } from "./phases/db-queries.js";
import { approveContent, rejectContent } from "./phases/review-manager.js";
import { loadContentConfig } from "./phases/state-manager.js";

// ---------------------------------------------------------------------------
// queue
// ---------------------------------------------------------------------------

/** List pending review items. */
export async function queueContent(): Promise<void> {
	const cwd = process.cwd();
	const config = await loadContentConfig(cwd);
	const dbPath = config.dbPath.replace(/^~/, homedir());
	if (!existsSync(dbPath)) {
		logger.info("No content database found. Run 'ck content setup' first.");
		return;
	}
	const db = initDatabase(dbPath);
	try {
		const items = [
			...getContentQueue(db, "draft"),
			...getContentQueue(db, "reviewing"),
			...getContentQueue(db, "scheduled"),
		];
		if (items.length === 0) {
			logger.info("Content queue is empty.");
		} else {
			logger.info(`${items.length} item(s) in queue:`);
			for (const item of items) {
				previewContent(item);
			}
		}
	} finally {
		db.close();
	}
}

// ---------------------------------------------------------------------------
// approve / reject
// ---------------------------------------------------------------------------

/** Approve content by ID. */
export async function approveContentCmd(id: string): Promise<void> {
	const cwd = process.cwd();
	const config = await loadContentConfig(cwd);
	const dbPath = config.dbPath.replace(/^~/, homedir());
	const db = initDatabase(dbPath);
	try {
		approveContent(db, Number.parseInt(id, 10));
		logger.success(`Content ${id} approved and scheduled for publishing.`);
	} finally {
		db.close();
	}
}

/** Reject content by ID. */
export async function rejectContentCmd(id: string, reason?: string): Promise<void> {
	const cwd = process.cwd();
	const config = await loadContentConfig(cwd);
	const dbPath = config.dbPath.replace(/^~/, homedir());
	const db = initDatabase(dbPath);
	try {
		rejectContent(db, Number.parseInt(id, 10), reason);
		logger.success(`Content ${id} rejected.${reason ? ` Reason: ${reason}` : ""}`);
	} finally {
		db.close();
	}
}
