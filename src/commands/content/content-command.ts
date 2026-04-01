/**
 * Main content daemon orchestrator.
 * Entry point for `ck content start` — initialises the logger, database,
 * and state, then runs the scan→create→publish cycle on a configurable interval.
 */

import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { logger } from "@/shared/logger.js";
import { createContent } from "./phases/content-creator.js";
import { ContentLogger } from "./phases/content-logger.js";
import { closeDatabase, initDatabase, runRetentionCleanup } from "./phases/db-manager.js";
import {
	getContentQueue,
	getUnprocessedEvents,
	incrementRetryCount,
	markEventProcessed,
	updateContentStatus,
} from "./phases/db-queries.js";
import { shouldCheckEngagement, trackEngagement } from "./phases/engagement-tracker.js";
import { scanGitRepos } from "./phases/git-scanner.js";
import type { PlatformAdapter } from "./phases/platform-adapters/adapter-interface.js";
import { FacebookAdapter } from "./phases/platform-adapters/facebook-adapter.js";
import { XAdapter } from "./phases/platform-adapters/x-adapter.js";
import { publishContent } from "./phases/publisher.js";
import { reviewContent } from "./phases/review-manager.js";
import type { Database } from "./phases/sqlite-client.js";
import { loadContentConfig, loadContentState, saveContentState } from "./phases/state-manager.js";
import type { ContentCommandOptions, ContentConfig, ContentState } from "./types.js";

const LOCK_DIR = join(homedir(), ".claudekit", "locks");
const LOCK_FILE = join(LOCK_DIR, "ck-content.lock");

/** Max times a failed content creation is retried before giving up */
const MAX_CREATION_RETRIES = 3;
/** Max failed items to retry publishing per cycle */
const MAX_PUBLISH_RETRIES_PER_CYCLE = 3;
/** Only retry failed publishes within this window (hours) */
const PUBLISH_RETRY_WINDOW_HOURS = 24;

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
			// Non-interactive environment cannot run setup wizard
			if (!process.stdin.isTTY) {
				contentLogger.error(
					"Content engine not enabled. Run 'ck content setup' interactively first.",
				);
				contentLogger.close();
				return;
			}
			contentLogger.warn("Content engine is not enabled. Launching setup wizard...");
			const { setupContent } = await import("./content-subcommands.js");
			await setupContent();
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

		// Initialize platform adapters
		const adapters = initializeAdapters(config);
		contentLogger.info(`Platform adapters: ${[...adapters.keys()].join(", ") || "none"}`);

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
				await runContentCycle(
					cwd,
					config,
					state,
					db,
					contentLogger,
					options,
					adapters,
					() => abortRequested,
				);
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

/** Instantiate platform adapters based on enabled config. */
function initializeAdapters(config: ContentConfig): Map<string, PlatformAdapter> {
	const adapters = new Map<string, PlatformAdapter>();
	if (config.platforms.x.enabled) {
		adapters.set("x", new XAdapter());
	}
	if (config.platforms.facebook.enabled) {
		adapters.set("facebook", new FacebookAdapter());
	}
	return adapters;
}

/** Execute one full content cycle: scan → create → review → publish → engage → cleanup. */
async function runContentCycle(
	cwd: string,
	config: ContentConfig,
	state: ContentState,
	db: Database,
	contentLogger: ContentLogger,
	options: ContentCommandOptions,
	adapters: Map<string, PlatformAdapter>,
	isAborted: () => boolean,
): Promise<void> {
	contentLogger.debug("Starting content cycle...");

	// Phase 2: Git scan
	const scanResult = await scanGitRepos(cwd, config, state, db, contentLogger);
	if (scanResult.contentWorthyEvents > 0) {
		contentLogger.info(`Found ${scanResult.contentWorthyEvents} content-worthy events.`);
	}

	// Phase 3: Content creation from unprocessed events (with retry protection)
	const events = getUnprocessedEvents(db);
	for (const event of events) {
		if (isAborted()) break;

		// Skip events that exceeded max retries
		if (event.retryCount >= MAX_CREATION_RETRIES) {
			contentLogger.warn(`Event ${event.id} exceeded ${MAX_CREATION_RETRIES} retries. Giving up.`);
			markEventProcessed(db, event.id);
			continue;
		}

		try {
			const items = await createContent(event, config, db, contentLogger, options);
			if (items.length > 0) {
				markEventProcessed(db, event.id);
			} else {
				// All platforms failed — increment retry, will try next cycle
				incrementRetryCount(db, event.id);
				contentLogger.warn(`No content created for event ${event.id}. Will retry next cycle.`);
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			contentLogger.error(`Content creation failed for event ${event.id}: ${msg}`);
			incrementRetryCount(db, event.id);
		}
	}

	// Phase 5: Review + Phase 4: Publish scheduled content
	const scheduled = getContentQueue(db, "scheduled");
	for (const item of scheduled) {
		if (isAborted()) break;
		const decision = await reviewContent(item, config, db, contentLogger);
		if (!decision.approved) continue;
		await publishContent(item, config, state, db, contentLogger, adapters, options);
	}

	// Phase 4b: Retry recently failed publishes
	const failedItems = getContentQueue(db, "failed");
	let retriesThisCycle = 0;
	for (const item of failedItems) {
		if (isAborted() || retriesThisCycle >= MAX_PUBLISH_RETRIES_PER_CYCLE) break;
		const failedAt = new Date(item.updatedAt).getTime();
		const hoursSinceFail = (Date.now() - failedAt) / (60 * 60 * 1000);
		if (hoursSinceFail >= PUBLISH_RETRY_WINDOW_HOURS) continue;

		contentLogger.info(`Retrying failed content ${item.id}...`);
		updateContentStatus(db, item.id, "scheduled");
		await publishContent(item, config, state, db, contentLogger, adapters, options);
		retriesThisCycle++;
	}

	// Phase 8: Engagement tracking
	if (
		shouldCheckEngagement(
			state.lastEngagementCheckAt,
			config.selfImprovement.engagementCheckIntervalHours,
		)
	) {
		await trackEngagement(db, adapters, config, contentLogger);
		state.lastEngagementCheckAt = new Date().toISOString();
	}

	// Data retention cleanup (once per day)
	if (shouldRunCleanup(state.lastCleanupAt)) {
		runRetentionCleanup(db);
		state.lastCleanupAt = new Date().toISOString();
		contentLogger.debug("Data retention cleanup completed.");
	}

	contentLogger.debug("Content cycle complete.");
}

/** Check if 24h has elapsed since last cleanup. */
function shouldRunCleanup(lastAt: string | null): boolean {
	if (!lastAt) return true;
	return Date.now() - new Date(lastAt).getTime() >= 24 * 60 * 60 * 1000;
}

/** Sleep that keeps the process alive (daemon must persist). */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}
