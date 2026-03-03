/**
 * Watch command orchestrator — long-running loop with process lock + heartbeat
 * Polls GitHub issues, spawns Claude for analysis, posts responses
 * Designed for 6-8+ hour unattended overnight operation
 */

import { rm, utimes } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { logger } from "@/shared/logger.js";
import { withProcessLock } from "@/shared/process-lock.js";
import pc from "picocolors";
import { runPollCycle } from "./phases/poll-cycle.js";
import { type SetupResult, validateSetup } from "./phases/setup-validator.js";
import { loadWatchConfig, loadWatchState, saveWatchState } from "./phases/state-manager.js";
import { WatchLogger } from "./phases/watch-logger.js";
import type { WatchCommandOptions, WatchState, WatchStats } from "./types.js";

const LOCK_NAME = "ck-watch";
const HEARTBEAT_INTERVAL = 30_000;

/**
 * Main entry point for `ck watch`
 */
export async function watchCommand(options: WatchCommandOptions): Promise<void> {
	let watchLog = new WatchLogger();
	await watchLog.init();

	const stats: WatchStats = {
		issuesProcessed: 0,
		plansCreated: 0,
		errors: 0,
		startedAt: new Date(),
		implementationsCompleted: 0,
	};

	let abortRequested = false;

	try {
		const projectDir = process.cwd();
		const config = await loadWatchConfig(projectDir);

		// Re-init logger with configured maxBytes
		if (config.logMaxBytes > 0) {
			watchLog = new WatchLogger(undefined, config.logMaxBytes);
			await watchLog.init();
		}

		watchLog.info("Validating setup...");
		const setup = await validateSetup();
		watchLog.info(`Watching ${setup.repoOwner}/${setup.repoName}`);
		const pollInterval = options.interval ?? config.pollIntervalMs;
		const state = await loadWatchState(projectDir);

		if (options.force) {
			await forceRemoveLock(watchLog);
			// Reset all state so previously-tracked issues get reprocessed
			state.activeIssues = {};
			state.processedIssues = [];
			state.lastCheckedAt = undefined;
			state.implementationQueue = [];
			state.currentlyImplementing = null;
			await saveWatchState(projectDir, state);
			watchLog.info("Watch state reset (--force)");
		}

		printBanner(setup, pollInterval, options, state);

		await withProcessLock(LOCK_NAME, async () => {
			const heartbeatPath = join(homedir(), ".claudekit", "locks", `${LOCK_NAME}.lock`);
			const heartbeat = setInterval(async () => {
				try {
					const now = new Date();
					await utimes(heartbeatPath, now, now);
				} catch {
					/* lock may be cleaned up */
				}
			}, HEARTBEAT_INTERVAL);

			const shutdown = async () => {
				if (abortRequested) return;
				abortRequested = true;
				watchLog.info("Shutdown requested, finishing current task...");

				for (const issue of Object.values(state.activeIssues)) {
					if (issue.status === "brainstorming" || issue.status === "planning") {
						issue.status = "new";
					}
				}

				// If implementation was in progress, revert so it re-queues on next start
				if (state.currentlyImplementing !== null) {
					watchLog.info(
						`Implementation in progress for #${state.currentlyImplementing}, reverting to awaiting_approval`,
					);
					const numStr = String(state.currentlyImplementing);
					if (state.activeIssues[numStr]) {
						state.activeIssues[numStr].status = "awaiting_approval";
					}
					state.currentlyImplementing = null;
				}

				await saveWatchState(projectDir, state);
				watchLog.printSummary(stats);
				watchLog.close();
				clearInterval(heartbeat);
			};

			process.on("SIGINT", shutdown);
			process.on("SIGTERM", shutdown);

			try {
				let processedThisHour = 0;
				let hourStart = Date.now();

				while (!abortRequested) {
					if (Date.now() - hourStart > 3600_000) {
						processedThisHour = 0;
						hourStart = Date.now();
					}

					try {
						processedThisHour = await runPollCycle(
							setup,
							config,
							state,
							options,
							watchLog,
							stats,
							projectDir,
							processedThisHour,
							() => abortRequested,
						);
					} catch (error) {
						watchLog.error("Poll cycle failed", error as Error);
						stats.errors++;
					}

					if (!abortRequested) await sleep(pollInterval);
				}
			} finally {
				clearInterval(heartbeat);
				process.removeListener("SIGINT", shutdown);
				process.removeListener("SIGTERM", shutdown);
			}
		});
	} catch (error) {
		if ((error as Error).message?.includes("Another ClaudeKit process")) {
			logger.error("Another ck watch instance is already running. Use --force to override.");
		} else {
			watchLog.error("Watch command failed", error as Error);
		}
		watchLog.close();
		process.exitCode = 1;
	}
}

/**
 * Force-remove stale lock file so a new instance can start
 */
async function forceRemoveLock(watchLog: WatchLogger): Promise<void> {
	const lockPath = join(homedir(), ".claudekit", "locks", `${LOCK_NAME}.lock`);
	try {
		await rm(lockPath, { recursive: true, force: true });
		watchLog.info("Removed existing lock file (--force)");
	} catch {
		/* lock file may not exist */
	}
}

function printBanner(
	setup: SetupResult,
	interval: number,
	options: WatchCommandOptions,
	state: WatchState,
): void {
	const queueLen = state.implementationQueue.length;
	const implementing = state.currentlyImplementing;
	const queueInfo =
		implementing !== null
			? `implementing #${implementing}`
			: queueLen > 0
				? `${queueLen} pending`
				: "idle";

	console.log();
	console.log(pc.bold("  ClaudeKit Watch"));
	console.log(pc.dim("  ─────────────────────"));
	console.log(`  ${pc.green("➜")} Repo: ${pc.cyan(`${setup.repoOwner}/${setup.repoName}`)}`);
	console.log(`  ${pc.green("➜")} Poll: ${pc.cyan(`${interval / 1000}s`)}`);
	console.log(
		`  ${pc.green("➜")} Skills: ${setup.skillsAvailable ? pc.green("available") : pc.yellow("fallback mode")}`,
	);
	console.log(`  ${pc.green("➜")} Queue: ${pc.cyan(queueInfo)}`);
	if (options.dryRun) {
		console.log(`  ${pc.yellow("➜")} Mode: ${pc.yellow("DRY RUN (no responses posted)")}`);
	}
	console.log(pc.dim("  Press Ctrl+C to stop"));
	console.log();
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
