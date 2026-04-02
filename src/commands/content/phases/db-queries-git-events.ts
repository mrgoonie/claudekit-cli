/**
 * SQLite query helpers for the git_events table.
 * All functions use better-sqlite3's synchronous API.
 */

import type { GitEvent, GitEventType } from "@/commands/content/types.js";
import type { Database } from "./sqlite-client.js";

// ---------------------------------------------------------------------------
// Internal raw row type (snake_case from SQLite)
// ---------------------------------------------------------------------------

interface RawGitEventRow {
	id: number;
	repo_path: string;
	repo_name: string;
	event_type: string;
	ref: string;
	title: string;
	body: string;
	author: string;
	created_at: string;
	processed: number;
	content_worthy: number;
	importance: string;
	retry_count: number;
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function mapGitEvent(row: RawGitEventRow): GitEvent {
	return {
		id: row.id,
		repoPath: row.repo_path,
		repoName: row.repo_name,
		eventType: row.event_type as GitEventType,
		ref: row.ref,
		title: row.title,
		body: row.body,
		author: row.author,
		createdAt: row.created_at,
		processed: row.processed === 1,
		contentWorthy: row.content_worthy === 1,
		importance: row.importance as GitEvent["importance"],
		retryCount: row.retry_count ?? 0,
	};
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Insert a git event. Uses INSERT OR IGNORE to skip duplicates
 * (UNIQUE constraint on repo_path + event_type + ref).
 * Returns the new row id, or 0 when the row was silently ignored.
 */
export function insertGitEvent(
	db: Database,
	event: Omit<GitEvent, "id" | "createdAt" | "processed" | "retryCount">,
): number {
	const stmt = db.prepare(`
		INSERT OR IGNORE INTO git_events
			(repo_path, repo_name, event_type, ref, title, body, author, content_worthy, importance)
		VALUES
			($repoPath, $repoName, $eventType, $ref, $title, $body, $author, $contentWorthy, $importance)
	`);
	const result = stmt.run({
		repoPath: event.repoPath,
		repoName: event.repoName,
		eventType: event.eventType,
		ref: event.ref,
		title: event.title,
		body: event.body,
		author: event.author,
		contentWorthy: event.contentWorthy ? 1 : 0,
		importance: event.importance,
	});
	return Number(result.lastInsertRowid);
}

/** Return all unprocessed events that the AI decided are content-worthy, oldest first. */
export function getUnprocessedEvents(db: Database): GitEvent[] {
	const rows = db
		.prepare(
			`SELECT * FROM git_events
			 WHERE processed = 0 AND content_worthy = 1
			 ORDER BY created_at ASC`,
		)
		.all() as RawGitEventRow[];
	return rows.map(mapGitEvent);
}

/** Mark a git event as processed so it is not picked up in future cycles. */
export function markEventProcessed(db: Database, eventId: number): void {
	db.prepare("UPDATE git_events SET processed = 1 WHERE id = ?").run(eventId);
}

/** Increment retry count for a git event that failed content creation. */
export function incrementRetryCount(db: Database, eventId: number): void {
	db.prepare("UPDATE git_events SET retry_count = retry_count + 1 WHERE id = ?").run(eventId);
}
