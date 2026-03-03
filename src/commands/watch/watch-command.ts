/**
 * Watch command orchestrator — long-running loop with process lock + heartbeat
 * Polls GitHub issues, spawns Claude for analysis, posts responses
 * Designed for 6-8+ hour unattended overnight operation
 */

import { utimes } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { logger } from "@/shared/logger.js";
import { withProcessLock } from "@/shared/process-lock.js";
import pc from "picocolors";
import { checkRateLimit, pollNewIssues } from "./phases/issue-poller.js";
import { checkActiveIssues, processNewIssue } from "./phases/issue-processor.js";
import { type SetupResult, validateSetup } from "./phases/setup-validator.js";
import { loadWatchConfig, loadWatchState, saveWatchState } from "./phases/state-manager.js";
import { WatchLogger } from "./phases/watch-logger.js";
import type { WatchCommandOptions, WatchConfig, WatchState, WatchStats } from "./types.js";

const LOCK_NAME = "ck-watch";
const HEARTBEAT_INTERVAL = 30_000;

/**
 * Main entry point for `ck watch`
 */
export async function watchCommand(options: WatchCommandOptions): Promise<void> {
	const watchLog = new WatchLogger();
	await watchLog.init();

	const stats: WatchStats = {
		issuesProcessed: 0,
		plansCreated: 0,
		errors: 0,
		startedAt: new Date(),
	};

	let abortRequested = false;

	try {
		watchLog.info("Validating setup...");
		const setup = await validateSetup();
		watchLog.info(`Watching ${setup.repoOwner}/${setup.repoName}`);

		const projectDir = process.cwd();
		const config = await loadWatchConfig(projectDir);
		const pollInterval = options.interval ?? config.pollIntervalMs;
		const state = await loadWatchState(projectDir);

		printBanner(setup, pollInterval, options);

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
			logger.error("Another ck watch instance is already running.");
		} else {
			watchLog.error("Watch command failed", error as Error);
		}
		watchLog.close();
		process.exitCode = 1;
	}
}

/**
 * Single poll cycle: fetch issues, process new ones, check active issues
 */
async function runPollCycle(
	setup: SetupResult,
	config: WatchConfig,
	state: WatchState,
	options: WatchCommandOptions,
	watchLog: WatchLogger,
	stats: WatchStats,
	projectDir: string,
	processedThisHour: number,
	isAborted: () => boolean,
): Promise<number> {
	const { issues } = await pollNewIssues(
		setup.repoOwner,
		setup.repoName,
		state.lastCheckedAt,
		config.excludeAuthors,
	);

	let count = processedThisHour;
	for (const issue of issues) {
		if (isAborted()) break;
		const numStr = String(issue.number);
		if (state.activeIssues[numStr] || state.processedIssues.includes(issue.number)) continue;

		if (!checkRateLimit(count, config.maxIssuesPerHour)) {
			watchLog.warn("Rate limit reached, skipping remaining issues");
			break;
		}

		try {
			await processNewIssue(issue, state, config, setup, options, watchLog, stats);
			count++;
		} catch (error) {
			watchLog.error(`Failed to process #${issue.number}`, error as Error);
			state.activeIssues[numStr] = {
				status: "error",
				turnsUsed: 0,
				createdAt: new Date().toISOString(),
				title: issue.title,
				conversationHistory: [],
			};
			stats.errors++;
		}
	}

	await checkActiveIssues(state, config, setup, options, watchLog, stats);

	state.lastCheckedAt = new Date().toISOString();
	await saveWatchState(projectDir, state);
	return count;
}

function printBanner(setup: SetupResult, interval: number, options: WatchCommandOptions): void {
	console.log();
	console.log(pc.bold("  ClaudeKit Watch"));
	console.log(pc.dim("  ─────────────────────"));
	console.log(`  ${pc.green("➜")} Repo: ${pc.cyan(`${setup.repoOwner}/${setup.repoName}`)}`);
	console.log(`  ${pc.green("➜")} Poll: ${pc.cyan(`${interval / 1000}s`)}`);
	console.log(
		`  ${pc.green("➜")} Skills: ${setup.skillsAvailable ? pc.green("available") : pc.yellow("fallback mode")}`,
	);
	if (options.dryRun) {
		console.log(`  ${pc.yellow("➜")} Mode: ${pc.yellow("DRY RUN (no responses posted)")}`);
	}
	console.log(pc.dim("  Press Ctrl+C to stop"));
	console.log();
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
