/**
 * SQLite query helpers for content_items, publications, and task_logs tables.
 * All functions use better-sqlite3's synchronous API.
 */

import type { Database } from "bun:sqlite";

import type {
	ContentItem,
	ContentStatus,
	Platform,
	Publication,
} from "@/commands/content/types.js";

// ---------------------------------------------------------------------------
// Internal raw row types (snake_case from SQLite)
// ---------------------------------------------------------------------------

interface RawContentItemRow {
	id: number;
	git_event_id: number;
	platform: string;
	text_content: string;
	hashtags: string;
	hook_line: string;
	call_to_action: string;
	media_path: string | null;
	status: string;
	scheduled_at: string | null;
	created_at: string;
	updated_at: string;
}

interface RawPublicationRow {
	id: number;
	content_item_id: number;
	platform: string;
	post_id: string;
	post_url: string;
	published_at: string;
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function mapContentItem(row: RawContentItemRow): ContentItem {
	return {
		id: row.id,
		gitEventId: row.git_event_id,
		platform: row.platform as Platform,
		textContent: row.text_content,
		hashtags: row.hashtags,
		hookLine: row.hook_line,
		callToAction: row.call_to_action,
		mediaPath: row.media_path,
		status: row.status as ContentStatus,
		scheduledAt: row.scheduled_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export function mapPublication(row: RawPublicationRow): Publication {
	return {
		id: row.id,
		contentItemId: row.content_item_id,
		platform: row.platform as Platform,
		postId: row.post_id,
		postUrl: row.post_url,
		publishedAt: row.published_at,
	};
}

// ---------------------------------------------------------------------------
// content_items queries
// ---------------------------------------------------------------------------

/** Insert a new content item and return its id. */
export function insertContentItem(
	db: Database,
	item: Omit<ContentItem, "id" | "createdAt" | "updatedAt">,
): number {
	const stmt = db.prepare(`
		INSERT INTO content_items
			(git_event_id, platform, text_content, hashtags, hook_line, call_to_action,
			 media_path, status, scheduled_at)
		VALUES
			($gitEventId, $platform, $textContent, $hashtags, $hookLine, $callToAction,
			 $mediaPath, $status, $scheduledAt)
	`);
	const result = stmt.run({
		gitEventId: item.gitEventId,
		platform: item.platform,
		textContent: item.textContent,
		hashtags: item.hashtags,
		hookLine: item.hookLine,
		callToAction: item.callToAction,
		mediaPath: item.mediaPath ?? null,
		status: item.status,
		scheduledAt: item.scheduledAt ?? null,
	});
	return Number(result.lastInsertRowid);
}

/** Update content item status and refresh its updated_at timestamp. */
export function updateContentStatus(db: Database, contentId: number, status: ContentStatus): void {
	db.prepare(
		`UPDATE content_items
		 SET status = ?, updated_at = datetime('now')
		 WHERE id = ?`,
	).run(status, contentId);
}

/** Fetch all content items with the given status, oldest first. */
export function getContentQueue(db: Database, status: ContentStatus): ContentItem[] {
	const rows = db
		.prepare(
			`SELECT * FROM content_items
			 WHERE status = ?
			 ORDER BY created_at ASC`,
		)
		.all(status) as RawContentItemRow[];
	return rows.map(mapContentItem);
}

/** Fetch the N most recently created content items. */
export function getRecentContent(db: Database, limit: number): ContentItem[] {
	const rows = db
		.prepare(
			`SELECT * FROM content_items
			 ORDER BY created_at DESC
			 LIMIT ?`,
		)
		.all(limit) as RawContentItemRow[];
	return rows.map(mapContentItem);
}

/** Fetch a single content item by id; returns null if not found. */
export function getContentById(db: Database, id: number): ContentItem | null {
	const row = db.prepare("SELECT * FROM content_items WHERE id = ?").get(id) as
		| RawContentItemRow
		| undefined;
	return row !== undefined ? mapContentItem(row) : null;
}

// ---------------------------------------------------------------------------
// publications queries
// ---------------------------------------------------------------------------

/** Record a successful publication and return its id. */
export function insertPublication(
	db: Database,
	pub: Omit<Publication, "id" | "publishedAt">,
): number {
	const stmt = db.prepare(`
		INSERT INTO publications (content_item_id, platform, post_id, post_url)
		VALUES ($contentItemId, $platform, $postId, $postUrl)
	`);
	const result = stmt.run({
		contentItemId: pub.contentItemId,
		platform: pub.platform,
		postId: pub.postId,
		postUrl: pub.postUrl,
	});
	return Number(result.lastInsertRowid);
}

// ---------------------------------------------------------------------------
// task_logs queries
// ---------------------------------------------------------------------------

export interface TaskLogInput {
	taskType: string;
	status: string;
	details: string;
	durationMs?: number | null;
}

/** Append a task log entry and return its id. */
export function insertTaskLog(db: Database, log: TaskLogInput): number {
	const stmt = db.prepare(`
		INSERT INTO task_logs (task_type, status, details, duration_ms)
		VALUES ($taskType, $status, $details, $durationMs)
	`);
	const result = stmt.run({
		taskType: log.taskType,
		status: log.status,
		details: log.details,
		durationMs: log.durationMs ?? null,
	});
	return Number(result.lastInsertRowid);
}
