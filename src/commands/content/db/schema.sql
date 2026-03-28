-- Reference schema for the content command SQLite database.
-- This file is documentation only — it is NOT executed at runtime.
-- The authoritative schema lives in phases/db-manager.ts (runMigrations).

-- ---------------------------------------------------------------------------
-- git_events
-- Records every git activity detected across monitored repos.
-- UNIQUE(repo_path, event_type, ref) prevents duplicate ingestion.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS git_events (
	id             INTEGER PRIMARY KEY AUTOINCREMENT,
	repo_path      TEXT    NOT NULL,
	repo_name      TEXT    NOT NULL,
	event_type     TEXT    NOT NULL,  -- commit | pr_merged | plan_completed | tag | release
	ref            TEXT    NOT NULL,  -- commit hash, PR number, tag name, or release tag
	title          TEXT    NOT NULL DEFAULT '',
	body           TEXT    NOT NULL DEFAULT '',
	author         TEXT    NOT NULL DEFAULT '',
	created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
	processed      INTEGER NOT NULL DEFAULT 0,  -- 0 = pending, 1 = done
	content_worthy INTEGER NOT NULL DEFAULT 0,  -- 1 = AI decided this is worth posting about
	importance     TEXT    NOT NULL DEFAULT 'low',  -- high | medium | low
	UNIQUE(repo_path, event_type, ref)
);

CREATE INDEX IF NOT EXISTS idx_git_events_processed ON git_events(processed);

-- ---------------------------------------------------------------------------
-- content_items
-- One row per platform variant of generated content.
-- A single git_event can produce multiple content_items (one per platform).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS content_items (
	id             INTEGER PRIMARY KEY AUTOINCREMENT,
	git_event_id   INTEGER NOT NULL,
	platform       TEXT    NOT NULL,  -- x | x_thread | facebook
	text_content   TEXT    NOT NULL DEFAULT '',
	hashtags       TEXT    NOT NULL DEFAULT '[]',  -- JSON array string
	hook_line      TEXT    NOT NULL DEFAULT '',
	call_to_action TEXT    NOT NULL DEFAULT '',
	media_path     TEXT,              -- NULL if no image/video attachment
	status         TEXT    NOT NULL DEFAULT 'draft',
	  -- draft | scheduled | reviewing | approved | publishing | published | failed
	scheduled_at   TEXT,              -- ISO-8601 UTC; NULL means publish immediately when approved
	created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
	updated_at     TEXT    NOT NULL DEFAULT (datetime('now')),
	FOREIGN KEY (git_event_id) REFERENCES git_events(id)
);

CREATE INDEX IF NOT EXISTS idx_content_items_status ON content_items(status);

-- ---------------------------------------------------------------------------
-- publications
-- Records successful posts with platform-assigned post IDs and URLs.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS publications (
	id              INTEGER PRIMARY KEY AUTOINCREMENT,
	content_item_id INTEGER NOT NULL,
	platform        TEXT    NOT NULL,
	post_id         TEXT    NOT NULL,  -- platform-assigned ID (e.g. tweet ID)
	post_url        TEXT    NOT NULL DEFAULT '',
	published_at    TEXT    NOT NULL DEFAULT (datetime('now')),
	FOREIGN KEY (content_item_id) REFERENCES content_items(id)
);

CREATE INDEX IF NOT EXISTS idx_publications_platform ON publications(platform);

-- ---------------------------------------------------------------------------
-- engagement_metrics
-- Periodic snapshots of likes/shares/comments/impressions per publication.
-- Multiple rows per publication (one per check interval).
-- ---------------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS idx_engagement_publication ON engagement_metrics(publication_id);

-- ---------------------------------------------------------------------------
-- task_logs
-- Append-only operational log for daemon tasks (scan, generate, publish, etc.).
-- Useful for debugging and self-improvement analysis.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_logs (
	id          INTEGER PRIMARY KEY AUTOINCREMENT,
	task_type   TEXT    NOT NULL,          -- scan | generate | publish | engagement_check
	status      TEXT    NOT NULL DEFAULT 'started',  -- started | completed | failed
	details     TEXT    NOT NULL DEFAULT '',          -- JSON or plain text context
	duration_ms INTEGER,                              -- NULL if still running or failed before measuring
	created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
