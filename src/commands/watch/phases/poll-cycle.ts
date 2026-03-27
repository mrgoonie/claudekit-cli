/**
 * Poll cycle — single iteration of the watch loop
 * Handles: new issue polling, active issue checking, approval checking, implementation queue
 * Extracted from watch-command.ts to keep files under 200 LOC
 */

import type { WatchCommandOptions, WatchConfig, WatchState, WatchStats } from "../types.js";
import { runImplementation } from "./implementation-runner.js";
import { checkRateLimit, pollNewIssues } from "./issue-poller.js";
import { checkActiveIssues, processNewIssue } from "./issue-processor.js";
import { resolveMaintainers } from "./maintainer-resolver.js";
import type { SetupResult } from "./setup-validator.js";
import { cleanExpiredIssues, isProcessed, removeFromProcessed } from "./state-cleanup.js";
import { saveWatchState } from "./state-manager.js";
import type { WatchLogger } from "./watch-logger.js";

/**
 * Single poll cycle: fetch issues, process new ones, check active, process implementation queue
 */
export async function runPollCycle(
	setup: SetupResult,
	config: WatchConfig,
	state: WatchState,
	options: WatchCommandOptions,
	watchLog: WatchLogger,
	stats: WatchStats,
	projectDir: string,
	processedThisHour: number,
	isAborted: () => boolean,
	hourStart?: number,
): Promise<number> {
	// Resolve maintainer logins once per cycle (cached 1h)
	// Use local flag — never mutate config.skipMaintainerReplies (transient API failures shouldn't permanently disable)
	let maintainerLogins: string[] = [];
	if (config.skipMaintainerReplies) {
		const result = await resolveMaintainers(
			setup.repoOwner,
			setup.repoName,
			config.excludeAuthors,
			config.autoDetectMaintainers,
		);
		if (!result.disabled) {
			maintainerLogins = result.users;
		}
		// When disabled (API failed), maintainerLogins stays empty → no filtering this cycle
		// Next cycle retries after cache TTL expires
	}

	// Clean expired processedIssues and stale activeIssues each cycle
	cleanExpiredIssues(state, config.processedIssueTtlDays);

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

		// Re-enroll completed issues that received new comments
		if (isProcessed(state.processedIssues, issue.number) && !state.activeIssues[numStr]) {
			watchLog.info(`Re-enrolling completed issue #${issue.number} (new activity detected)`);
			state.processedIssues = removeFromProcessed(state.processedIssues, issue.number);
			state.activeIssues[numStr] = {
				status: "clarifying",
				turnsUsed: 0,
				createdAt: new Date().toISOString(),
				title: issue.title,
				conversationHistory: [],
			};
			continue;
		}

		if (state.activeIssues[numStr]) continue;

		if (!checkRateLimit(count, config.maxIssuesPerHour)) {
			watchLog.warn("Rate limit reached, skipping remaining issues");
			break;
		}

		try {
			await processNewIssue(issue, state, config, setup, options, watchLog, stats, projectDir);
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

	await checkActiveIssues(
		state,
		config,
		setup,
		options,
		watchLog,
		stats,
		projectDir,
		maintainerLogins,
	);

	// Process implementation queue — one at a time, sequential
	await processImplementationQueue(
		state,
		config,
		setup,
		options,
		watchLog,
		stats,
		projectDir,
		isAborted,
	);

	state.lastCheckedAt = new Date().toISOString();
	state.processedThisHour = count;
	if (hourStart !== undefined) {
		state.hourStart = new Date(hourStart).toISOString();
	}
	await saveWatchState(projectDir, state);
	return count;
}

/**
 * Dequeue one approved issue and run its implementation
 * Only one implementation runs at a time (sequential, not parallel)
 */
async function processImplementationQueue(
	state: WatchState,
	config: WatchConfig,
	setup: SetupResult,
	options: WatchCommandOptions,
	watchLog: WatchLogger,
	stats: WatchStats,
	projectDir: string,
	isAborted: () => boolean,
): Promise<void> {
	if (state.currentlyImplementing !== null) return;
	if (state.implementationQueue.length === 0) return;
	if (isAborted()) return;

	const issueNumber = state.implementationQueue.shift() as number;
	const numStr = String(issueNumber);
	const issueState = state.activeIssues[numStr];

	if (!issueState) {
		watchLog.warn(`Queued issue #${issueNumber} not found in activeIssues, skipping`);
		return;
	}

	state.currentlyImplementing = issueNumber;
	issueState.status = "implementing";
	await saveWatchState(projectDir, state);

	watchLog.info(`Starting implementation for #${issueNumber}: ${issueState.title}`);

	const result = await runImplementation({
		issueNumber,
		issueTitle: issueState.title,
		planPath: issueState.planPath ?? "",
		repoOwner: setup.repoOwner,
		repoName: setup.repoName,
		timeoutSec: config.timeouts.implementSec,
		cwd: projectDir,
		dryRun: options.dryRun,
		showBranding: config.showBranding,
		worktreeEnabled: config.worktree.enabled,
		worktreeBaseBranch: config.worktree.baseBranch,
		worktreeAutoCleanup: config.worktree.autoCleanup,
	});

	if (result.success) {
		issueState.status = "completed";
		issueState.branchName = result.branchName;
		issueState.prUrl = result.prUrl ?? undefined;
		state.processedIssues.push({ issueNumber, processedAt: new Date().toISOString() });
		stats.implementationsCompleted++;
		watchLog.info(`Implementation completed for #${issueNumber} — PR: ${result.prUrl}`);
	} else {
		issueState.status = "error";
		issueState.branchName = result.branchName;
		stats.errors++;
		watchLog.error(`Implementation failed for #${issueNumber}: ${result.error ?? "unknown"}`);
	}

	state.currentlyImplementing = null;
	await saveWatchState(projectDir, state);
}
