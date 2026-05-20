/**
 * Watch command orchestrator — long-running loop with process lock + heartbeat
 * Supports single-repo (CWD is a git repo) and multi-repo (CWD has git subdirs) modes
 * Polls GitHub issues, spawns Claude for analysis, posts responses
 * Designed for 6-8+ hour unattended overnight operation
 */

import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "@/shared/logger.js";
import { getLockPaths, withProcessLock } from "@/shared/process-lock.js";
import pc from "picocolors";
import { runPollCycle } from "./phases/poll-cycle.js";
import { scanForRepos } from "./phases/repo-scanner.js";
import { type SetupResult, validateSetup } from "./phases/setup-validator.js";
import { loadWatchConfig, loadWatchState, saveWatchState } from "./phases/state-manager.js";
import { WatchLogger } from "./phases/watch-logger.js";
import { cleanupAllWorktrees } from "./phases/worktree-manager.js";
import type { WatchCommandOptions, WatchConfig, WatchState, WatchStats } from "./types.js";

const LOCK_NAME = "ck-watch";

/** Per-repo runtime context used during the watch loop */
interface RepoRuntime {
	setup: SetupResult;
	config: WatchConfig;
	state: WatchState;
	projectDir: string;
	processedThisHour: number;
	hourStart: number;
}

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
		const repos = await discoverRepos(options, watchLog);
		const pollInterval = options.interval ?? repos[0].config.pollIntervalMs;

		// Re-init logger with configured maxBytes from first repo
		if (repos[0].config.logMaxBytes > 0) {
			watchLog = new WatchLogger(undefined, repos[0].config.logMaxBytes);
			await watchLog.init();
		}

		// Cleanup orphan worktrees from previous crash
		for (const repo of repos) {
			if (repo.config.worktree.enabled) {
				await cleanupAllWorktrees(repo.projectDir).catch(() => {});
			}
		}

		printBanner(repos, pollInterval, options);

		await withProcessLock(
			LOCK_NAME,
			async () => {
				const shutdown = async () => {
					if (abortRequested) return;
					abortRequested = true;
					watchLog.info("Shutdown requested, finishing current task...");

					for (const repo of repos) {
						for (const issue of Object.values(repo.state.activeIssues)) {
							if (issue.status === "brainstorming" || issue.status === "planning") {
								issue.status = "new";
							}
						}
						if (repo.state.currentlyImplementing !== null) {
							watchLog.info(
								`Implementation in progress for #${repo.state.currentlyImplementing}, reverting to awaiting_approval`,
							);
							const numStr = String(repo.state.currentlyImplementing);
							if (repo.state.activeIssues[numStr]) {
								repo.state.activeIssues[numStr].status = "awaiting_approval";
							}
							repo.state.currentlyImplementing = null;
						}
						await saveWatchState(repo.projectDir, repo.state);
						if (repo.config.worktree.enabled) {
							await cleanupAllWorktrees(repo.projectDir).catch(() => {});
						}
					}

					watchLog.printSummary(stats);
					watchLog.close();
				};

				process.on("SIGINT", shutdown);
				process.on("SIGTERM", shutdown);

				try {
					while (!abortRequested) {
						for (const repo of repos) {
							if (abortRequested) break;

							if (Date.now() - repo.hourStart > 3600_000) {
								repo.processedThisHour = 0;
								repo.hourStart = Date.now();
								repo.state.processedThisHour = 0;
								repo.state.hourStart = new Date(repo.hourStart).toISOString();
							}

							try {
								repo.processedThisHour = await runPollCycle(
									repo.setup,
									repo.config,
									repo.state,
									options,
									watchLog,
									stats,
									repo.projectDir,
									repo.processedThisHour,
									() => abortRequested,
									repo.hourStart,
								);
							} catch (error) {
								const repoId = `${repo.setup.repoOwner}/${repo.setup.repoName}`;
								watchLog.error(`Poll cycle failed for ${repoId}`, error as Error);
								stats.errors++;
							}
						}

						if (!abortRequested) await sleep(pollInterval);
					}
				} finally {
					process.removeListener("SIGINT", shutdown);
					process.removeListener("SIGTERM", shutdown);
				}
			},
			"long",
		);
	} catch (error) {
		const err = error as Error;
		if (err.message?.includes("Another ClaudeKit process")) {
			logger.error("Another ck watch instance is already running. Use --force to override.");
		} else if (err.message?.includes("Lock was compromised")) {
			logger.error("Lock was compromised (stale or externally removed). Use --force to restart.");
		} else {
			watchLog.error("Watch command failed", err);
			console.error(`[ck watch] Fatal: ${err.message}`);
			if (err.stack) logger.verbose(err.stack);
		}
		watchLog.close();
		process.exitCode = 1;
	}
}

/**
 * Discover repos to watch — single repo if CWD is a git repo, else scan subdirs
 */
async function discoverRepos(
	options: WatchCommandOptions,
	watchLog: WatchLogger,
): Promise<RepoRuntime[]> {
	const cwd = process.cwd();
	const isGitRepo = existsSync(join(cwd, ".git"));

	if (options.force) {
		await forceRemoveLock(watchLog);
	}

	if (isGitRepo) {
		watchLog.info("Validating setup...");
		const setup = await validateSetup(cwd);
		watchLog.info(`Watching ${setup.repoOwner}/${setup.repoName}`);
		const config = await loadWatchConfig(cwd);
		const state = await loadWatchState(cwd);
		if (options.force) resetState(state, cwd, watchLog);
		const hourStartMs = state.hourStart ? Date.parse(state.hourStart) : Date.now();
		const isCurrentHour = Date.now() - hourStartMs < 3600_000;
		return [
			{
				setup,
				config,
				state,
				projectDir: cwd,
				processedThisHour: isCurrentHour ? state.processedThisHour : 0,
				hourStart: isCurrentHour ? hourStartMs : Date.now(),
			},
		];
	}

	// Multi-repo mode: scan subdirectories
	watchLog.info(`Scanning subdirectories of ${cwd} for git repos...`);
	const scanned = await scanForRepos(cwd);
	if (scanned.length === 0) {
		throw new Error(
			"No git repositories found in subdirectories.\n" +
				"Run from a git repo or a parent directory containing git repos.",
		);
	}

	const repos: RepoRuntime[] = [];
	for (const repo of scanned) {
		try {
			const setup = await validateSetup(repo.dir);
			const config = await loadWatchConfig(repo.dir);
			const state = await loadWatchState(repo.dir);
			if (options.force) resetState(state, repo.dir, watchLog);
			watchLog.info(`Discovered ${setup.repoOwner}/${setup.repoName}`);
			const hourStartMs = state.hourStart ? Date.parse(state.hourStart) : Date.now();
			const isCurrentHour = Date.now() - hourStartMs < 3600_000;
			repos.push({
				setup,
				config,
				state,
				projectDir: repo.dir,
				processedThisHour: isCurrentHour ? state.processedThisHour : 0,
				hourStart: isCurrentHour ? hourStartMs : Date.now(),
			});
		} catch (error) {
			watchLog.warn(`Skipping ${repo.dir}: ${error instanceof Error ? error.message : "Unknown"}`);
		}
	}

	if (repos.length === 0) {
		throw new Error("All discovered repos failed validation. Check gh auth and repo remotes.");
	}

	watchLog.info(`Watching ${repos.length} repositories`);
	return repos;
}

/** Reset watch state for --force restarts */
async function resetState(
	state: WatchState,
	projectDir: string,
	watchLog: WatchLogger,
): Promise<void> {
	state.activeIssues = {};
	state.processedIssues = [];
	state.lastCheckedAt = undefined;
	state.implementationQueue = [];
	state.currentlyImplementing = null;
	await saveWatchState(projectDir, state);
	watchLog.info(`Watch state reset (--force) for ${projectDir}`);
}

/** Force-remove stale lock file so a new instance can start.
 * Removes both the resource file and the proper-lockfile lock directory (.lock.lock). */
async function forceRemoveLock(watchLog: WatchLogger): Promise<void> {
	const { resource, lockfile } = getLockPaths(LOCK_NAME);
	try {
		await Promise.all([
			rm(resource, { recursive: true, force: true }),
			rm(lockfile, { recursive: true, force: true }),
		]);
		watchLog.info("Removed existing lock file (--force)");
	} catch {
		/* lock file may not exist */
	}
}

function printBanner(repos: RepoRuntime[], interval: number, options: WatchCommandOptions): void {
	console.log();
	console.log(pc.bold("  ClaudeKit Watch"));
	console.log(pc.dim("  ─────────────────────"));

	if (repos.length === 1) {
		const r = repos[0];
		const queueInfo = formatQueueInfo(r.state);
		console.log(`  ${pc.green("➜")} Repo: ${pc.cyan(`${r.setup.repoOwner}/${r.setup.repoName}`)}`);
		console.log(`  ${pc.green("➜")} Queue: ${pc.cyan(queueInfo)}`);
	} else {
		console.log(`  ${pc.green("➜")} Repos: ${pc.cyan(String(repos.length))}`);
		for (const r of repos) {
			const queueInfo = formatQueueInfo(r.state);
			console.log(
				`    ${pc.dim("•")} ${pc.cyan(`${r.setup.repoOwner}/${r.setup.repoName}`)} (${queueInfo})`,
			);
		}
	}

	console.log(`  ${pc.green("➜")} Poll: ${pc.cyan(`${interval / 1000}s`)}`);
	const skillsOk = repos.every((r) => r.setup.skillsAvailable);
	console.log(
		`  ${pc.green("➜")} Skills: ${skillsOk ? pc.green("available") : pc.yellow("fallback mode")}`,
	);
	if (options.dryRun) {
		console.log(`  ${pc.yellow("➜")} Mode: ${pc.yellow("DRY RUN (no responses posted)")}`);
	}
	console.log(pc.dim("  Press Ctrl+C to stop"));
	console.log();
}

function formatQueueInfo(state: WatchState): string {
	if (state.currentlyImplementing !== null) return `implementing #${state.currentlyImplementing}`;
	if (state.implementationQueue.length > 0) return `${state.implementationQueue.length} pending`;
	return "idle";
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
