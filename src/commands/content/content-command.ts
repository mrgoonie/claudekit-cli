/**
 * Main content daemon orchestrator.
 * Entry point for `ck content start` — initialises the logger, database,
 * and state, then runs the scan→create→publish cycle on a configurable interval.
 */

import type { Database } from "bun:sqlite";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { logger } from "@/shared/logger.js";
import { createContent } from "./phases/content-creator.js";
import { ContentLogger } from "./phases/content-logger.js";
import { closeDatabase, initDatabase } from "./phases/db-manager.js";
import { getContentQueue, getUnprocessedEvents, markEventProcessed } from "./phases/db-queries.js";
import { shouldCheckEngagement, trackEngagement } from "./phases/engagement-tracker.js";
import { scanGitRepos } from "./phases/git-scanner.js";
import { publishContent } from "./phases/publisher.js";
import { reviewContent } from "./phases/review-manager.js";
import { loadContentConfig, loadContentState, saveContentState } from "./phases/state-manager.js";
import type { ContentCommandOptions, ContentConfig, ContentState } from "./types.js";

const LOCK_DIR = join(homedir(), ".claudekit", "locks");
const LOCK_FILE = join(LOCK_DIR, "ck-content.lock");

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start the content daemon.
 * Blocks until SIGINT / SIGTERM is received or a fatal error occurs.
 */
export async function contentCommand(options: ContentCommandOptions): Promise<void> {
	const cwd = process.cwd();
	const contentLogger = new ContentLogger();
	let abortRequested = false;

	try {
		contentLogger.init();
		contentLogger.info("Starting CK Content daemon...");

		if (options.verbose) {
			logger.setVerbose(true);
		}

		// Load and validate config — run setup wizard if not enabled
		let config = await loadContentConfig(cwd);
		if (!config.enabled) {
			contentLogger.warn("Content engine is not enabled. Launching setup wizard...");
			const { setupContent } = await import("./content-subcommands.js");
			await setupContent();
			// Reload config after setup
			config = await loadContentConfig(cwd);
			if (!config.enabled) {
				contentLogger.warn("Setup incomplete. Exiting.");
				contentLogger.close();
				return;
			}
			contentLogger.info("Setup complete. Starting daemon...");
		}

		// Write PID lock file
		if (!existsSync(LOCK_DIR)) mkdirSync(LOCK_DIR, { recursive: true });
		writeFileSync(LOCK_FILE, String(process.pid), "utf-8");

		// Resolve DB path (expand leading ~)
		const dbPath = config.dbPath.replace(/^~/, homedir());
		const db = initDatabase(dbPath);
		contentLogger.info(`Database initialised at ${dbPath}`);

		// Load persisted runtime state
		const state = await loadContentState(cwd);

		// Register graceful-shutdown handlers
		let shutdownCalled = false;
		const shutdown = async () => {
			if (shutdownCalled) return;
			shutdownCalled = true;
			abortRequested = true;
			contentLogger.info("Shutting down gracefully...");
			try {
				unlinkSync(LOCK_FILE);
			} catch {}
			await saveContentState(cwd, state);
			closeDatabase(db);
			contentLogger.close();
		};

		process.on("SIGINT", async () => {
			await shutdown();
			process.exit(130);
		});
		process.on("SIGTERM", async () => {
			await shutdown();
			process.exit(143);
		});

		contentLogger.info(
			`Content daemon running (PID: ${process.pid}). Poll interval: ${config.pollIntervalMs}ms`,
		);

		// Main event loop
		while (!abortRequested) {
			try {
				await runContentCycle(cwd, config, state, db, contentLogger, options, () => abortRequested);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				contentLogger.error(`Content cycle error: ${msg}`);
			}

			await saveContentState(cwd, state);
			await sleep(config.pollIntervalMs);
		}

		await shutdown();
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		contentLogger.error(`Fatal error: ${msg}`);
		try {
			unlinkSync(LOCK_FILE);
		} catch {}
		contentLogger.close();
		process.exit(1);
	}
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Execute one full content cycle: scan → create → review → publish. */
async function runContentCycle(
	cwd: string,
	config: ContentConfig,
	state: ContentState,
	db: Database,
	contentLogger: ContentLogger,
	options: ContentCommandOptions,
	isAborted: () => boolean,
): Promise<void> {
	contentLogger.debug("Starting content cycle...");

	// Phase 2: Git scan
	const scanResult = await scanGitRepos(cwd, config, state, db, contentLogger);
	if (scanResult.contentWorthyEvents > 0) {
		contentLogger.info(`Found ${scanResult.contentWorthyEvents} content-worthy events.`);
	}

	// Phase 3: Content creation from unprocessed events
	const events = getUnprocessedEvents(db);
	for (const event of events) {
		if (isAborted()) break;
		await createContent(event, config, db, contentLogger, options);
		markEventProcessed(db, event.id);
	}

	// Phase 5: Review + Phase 4: Publish scheduled content
	const scheduled = getContentQueue(db, "scheduled");
	for (const item of scheduled) {
		if (isAborted()) break;
		const decision = await reviewContent(item, config, db, contentLogger);
		if (!decision.approved) continue;
		await publishContent(item, config, state, db, contentLogger, new Map(), options);
	}

	// Phase 8: Engagement tracking
	if (
		shouldCheckEngagement(
			state.lastEngagementCheckAt,
			config.selfImprovement.engagementCheckIntervalHours,
		)
	) {
		await trackEngagement(db, new Map(), config, contentLogger);
		state.lastEngagementCheckAt = new Date().toISOString();
	}

	contentLogger.debug("Content cycle complete.");
}

/** Sleep that keeps the process alive (daemon must persist). */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}
