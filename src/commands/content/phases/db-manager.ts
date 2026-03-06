/**
 * SQLite database manager for the content command.
 * Uses bun:sqlite (built-in) for Bun runtime compatibility.
 */

import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Open (or create) the SQLite database at dbPath.
 * Ensures the parent directory exists, enables WAL mode, and runs migrations.
 */
export function initDatabase(dbPath: string): Database {
	ensureParentDir(dbPath);

	const db = new Database(dbPath, { create: true });

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

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function ensureParentDir(dbPath: string): void {
	const dir = dirname(dbPath);
	if (dir && !existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
}

/**
 * Idempotent schema creation — safe to call on every startup.
 */
function runMigrations(db: Database): void {
	db.exec(`
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
	`);
}
