/**
 * SQLite database manager for the content command.
 * Uses better-sqlite3 so the published CLI runs under plain Node.js.
 * Includes versioned schema migrations and data retention cleanup.
 */

import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { type Database, openDatabase } from "./sqlite-client.js";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Open (or create) the SQLite database at dbPath.
 * Ensures the parent directory exists, enables WAL mode, and runs migrations.
 */
export function initDatabase(dbPath: string): Database {
	ensureParentDir(dbPath);

	const db = openDatabase(dbPath);

	// WAL mode: better concurrent read performance
	db.exec("PRAGMA journal_mode = WAL");
	db.exec("PRAGMA busy_timeout = 5000");

	runMigrations(db);

	return db;
}

/**
 * Safely close the database connection, ignoring any errors.
 */
export function closeDatabase(db: Database): void {
	try {
		db.close();
	} catch {
		// Ignore — already closed or never opened cleanly
	}
}

/**
 * Delete old operational data beyond retention window.
 * Preserves content_items and publications (content archive).
 */
export function runRetentionCleanup(db: Database, retentionDays = 90): void {
	const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

	db.prepare("DELETE FROM engagement_metrics WHERE checked_at < ?").run(cutoff);
	db.prepare("DELETE FROM task_logs WHERE created_at < ?").run(cutoff);
	db.prepare("DELETE FROM git_events WHERE processed = 1 AND created_at < ?").run(cutoff);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function ensureParentDir(dbPath: string): void {
	const dir = dirname(dbPath);
	if (dir && !existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
}

/** Get current schema version; returns 0 if table doesn't exist. */
function getCurrentSchemaVersion(db: Database): number {
	try {
		const row = db.prepare("SELECT MAX(version) as v FROM schema_version").get() as
			| { v: number | null }
			| undefined;
		return row?.v ?? 0;
	} catch {
		return 0;
	}
}

/**
 * Versioned schema migration runner.
 * Each migration runs exactly once. Version tracked in schema_version table.
 */
function runMigrations(db: Database): void {
	db.exec("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)");

	const currentVersion = getCurrentSchemaVersion(db);

	const migrations: Array<{ version: number; sql: string }> = [
		{ version: 1, sql: SCHEMA_V1 },
		{ version: 2, sql: SCHEMA_V2_RETRY_COUNT },
	];

	for (const migration of migrations) {
		if (migration.version > currentVersion) {
			try {
				db.exec(migration.sql);
			} catch (err) {
				// ALTER TABLE ADD COLUMN may fail with "duplicate column" if schema was
				// manually edited or if a pre-migration-system DB already has the column.
				// This is safe to ignore for additive migrations.
				const msg = err instanceof Error ? err.message : String(err);
				if (!msg.includes("duplicate column")) throw err;
			}
			db.prepare("INSERT OR REPLACE INTO schema_version (version) VALUES (?)").run(
				migration.version,
			);
		}
	}
}

// ---------------------------------------------------------------------------
// Schema definitions
// ---------------------------------------------------------------------------

/** V1: Original full schema (IF NOT EXISTS for idempotent first-time install). */
const SCHEMA_V1 = `
	CREATE TABLE IF NOT EXISTS git_events (
		id           INTEGER PRIMARY KEY AUTOINCREMENT,
		repo_path    TEXT    NOT NULL,
		repo_name    TEXT    NOT NULL,
		event_type   TEXT    NOT NULL,
		ref          TEXT    NOT NULL,
		title        TEXT    NOT NULL DEFAULT '',
		body         TEXT    NOT NULL DEFAULT '',
		author       TEXT    NOT NULL DEFAULT '',
		created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
		processed    INTEGER NOT NULL DEFAULT 0,
		content_worthy INTEGER NOT NULL DEFAULT 0,
		importance   TEXT    NOT NULL DEFAULT 'low',
		UNIQUE(repo_path, event_type, ref)
	);

	CREATE TABLE IF NOT EXISTS content_items (
		id             INTEGER PRIMARY KEY AUTOINCREMENT,
		git_event_id   INTEGER NOT NULL,
		platform       TEXT    NOT NULL,
		text_content   TEXT    NOT NULL DEFAULT '',
		hashtags       TEXT    NOT NULL DEFAULT '[]',
		hook_line      TEXT    NOT NULL DEFAULT '',
		call_to_action TEXT    NOT NULL DEFAULT '',
		media_path     TEXT,
		status         TEXT    NOT NULL DEFAULT 'draft',
		scheduled_at   TEXT,
		created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
		updated_at     TEXT    NOT NULL DEFAULT (datetime('now')),
		FOREIGN KEY (git_event_id) REFERENCES git_events(id)
	);

	CREATE TABLE IF NOT EXISTS publications (
		id              INTEGER PRIMARY KEY AUTOINCREMENT,
		content_item_id INTEGER NOT NULL,
		platform        TEXT    NOT NULL,
		post_id         TEXT    NOT NULL,
		post_url        TEXT    NOT NULL DEFAULT '',
		published_at    TEXT    NOT NULL DEFAULT (datetime('now')),
		FOREIGN KEY (content_item_id) REFERENCES content_items(id)
	);

	CREATE TABLE IF NOT EXISTS engagement_metrics (
		id             INTEGER PRIMARY KEY AUTOINCREMENT,
		publication_id INTEGER NOT NULL,
		likes          INTEGER NOT NULL DEFAULT 0,
		shares         INTEGER NOT NULL DEFAULT 0,
		comments       INTEGER NOT NULL DEFAULT 0,
		impressions    INTEGER NOT NULL DEFAULT 0,
		checked_at     TEXT    NOT NULL DEFAULT (datetime('now')),
		FOREIGN KEY (publication_id) REFERENCES publications(id)
	);

	CREATE TABLE IF NOT EXISTS task_logs (
		id          INTEGER PRIMARY KEY AUTOINCREMENT,
		task_type   TEXT    NOT NULL,
		status      TEXT    NOT NULL DEFAULT 'started',
		details     TEXT    NOT NULL DEFAULT '',
		duration_ms INTEGER,
		created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
	);

	CREATE INDEX IF NOT EXISTS idx_git_events_processed
		ON git_events(processed);

	CREATE INDEX IF NOT EXISTS idx_content_items_status
		ON content_items(status);

	CREATE INDEX IF NOT EXISTS idx_publications_platform
		ON publications(platform);

	CREATE INDEX IF NOT EXISTS idx_engagement_publication
		ON engagement_metrics(publication_id);
`;

/** V2: Add retry_count to git_events for content creation retry tracking. */
const SCHEMA_V2_RETRY_COUNT = `
	ALTER TABLE git_events ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;
`;
