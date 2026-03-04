/**
 * Subcommand handlers for `ck content` sub-actions:
 *   start   — launch the content daemon (optionally killing an existing one)
 *   stop    — send SIGTERM to a running daemon via its PID lock file
 *   status  — display running state, config summary, and last-scan time
 *   logs    — print or follow today's content log file
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { logger } from "@/shared/logger.js";
import { contentCommand } from "./content-command.js";
import { ContentLogger } from "./phases/content-logger.js";
import { runSetupWizard } from "./phases/setup-wizard.js";
import { loadContentConfig, loadContentState } from "./phases/state-manager.js";
import type { ContentCommandOptions } from "./types.js";

export { approveContentCmd, queueContent, rejectContentCmd } from "./content-review-commands.js";

const LOCK_DIR = join(homedir(), ".claudekit", "locks");
const LOCK_NAME = "ck-content";

// ---------------------------------------------------------------------------
// start
// ---------------------------------------------------------------------------

/**
 * Start the content daemon.
 * If --force is supplied, stop any currently-running instance first.
 */
export async function startContent(options: ContentCommandOptions): Promise<void> {
	if (options.force) {
		await stopContent();
	}
	await contentCommand(options);
}

// ---------------------------------------------------------------------------
// stop
// ---------------------------------------------------------------------------

/**
 * Stop the content daemon by sending SIGTERM to the PID stored in the lock file.
 * No-ops gracefully when the daemon is not running.
 */
export async function stopContent(): Promise<void> {
	const lockFile = join(LOCK_DIR, `${LOCK_NAME}.lock`);

	if (!existsSync(lockFile)) {
		logger.info("Content daemon is not running.");
		return;
	}

	try {
		const pidStr = readFileSync(lockFile, "utf-8").trim();
		const pid = Number.parseInt(pidStr, 10);
		if (!Number.isNaN(pid)) {
			process.kill(pid, "SIGTERM");
			logger.success("Sent stop signal to content daemon.");
		} else {
			logger.warning("Lock file contains invalid PID — daemon may have exited uncleanly.");
		}
	} catch {
		logger.warning("Could not stop daemon. It may have already exited.");
	}
}

// ---------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------

/**
 * Print running state plus a summary of the current config and last-scan time.
 */
export async function statusContent(): Promise<void> {
	const cwd = process.cwd();
	const lockFile = join(LOCK_DIR, `${LOCK_NAME}.lock`);
	const isRunning = existsSync(lockFile);

	if (isRunning) {
		try {
			const pidStr = readFileSync(lockFile, "utf-8").trim();
			logger.success(`Content daemon is running (PID: ${pidStr})`);
		} catch {
			logger.success("Content daemon is running.");
		}
	} else {
		logger.info("Content daemon is not running.");
	}

	// Config + state summary (non-fatal if .ck.json is absent)
	try {
		const config = await loadContentConfig(cwd);
		const state = await loadContentState(cwd);

		console.log();
		console.log(`  Enabled:    ${config.enabled ? "Yes" : "No"}`);
		console.log(`  X/Twitter:  ${config.platforms.x.enabled ? "Enabled" : "Disabled"}`);
		console.log(`  Facebook:   ${config.platforms.facebook.enabled ? "Enabled" : "Disabled"}`);
		console.log(`  Review:     ${config.reviewMode}`);
		console.log(`  Last scan:  ${state.lastScanAt ?? "Never"}`);
		console.log();
	} catch {
		// Config not yet initialised — silently skip the summary block
	}
}

// ---------------------------------------------------------------------------
// logs
// ---------------------------------------------------------------------------

/**
 * Print today's content log file.
 * Pass --tail (options.tail) to follow in real-time via `tail -f`.
 */
export async function logsContent(options: ContentCommandOptions): Promise<void> {
	const logDir = join(homedir(), ".claudekit", "logs");
	const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
	const logPath = join(logDir, `content-${dateStr}.log`);

	if (!existsSync(logPath)) {
		logger.info("No content logs found for today.");
		return;
	}

	if (options.tail) {
		const { spawn } = await import("node:child_process");
		const tail = spawn("tail", ["-f", logPath], { stdio: "inherit" });
		process.on("SIGINT", () => {
			tail.kill();
			process.exit(0);
		});
	} else {
		const content = readFileSync(logPath, "utf-8");
		console.log(content);
	}
}

// ---------------------------------------------------------------------------
// setup
// ---------------------------------------------------------------------------

/** Interactive onboarding wizard. */
export async function setupContent(): Promise<void> {
	const cwd = process.cwd();
	const contentLogger = new ContentLogger();
	contentLogger.init();
	await runSetupWizard(cwd, contentLogger);
	contentLogger.close();
}
