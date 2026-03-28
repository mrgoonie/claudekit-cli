/**
 * Issue processor — handles individual issue brainstorm, clarification, and plan lifecycle
 * Extracted from watch-command.ts to keep files under 200 LOC
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
	GitHubIssue,
	WatchCommandOptions,
	WatchConfig,
	WatchState,
	WatchStats,
} from "../types.js";
import { checkAwaitingApproval } from "./approval-checker.js";
import { buildBrainstormPrompt, invokeClaude } from "./claude-invoker.js";
import { getAllComments, isOwnComment, pollComments } from "./comment-poller.js";
import { findRecentPlanDir } from "./plan-dir-finder.js";
import { buildClarificationPrompt, invokePlanGeneration } from "./plan-lifecycle.js";
import { postRawResponse, postResponse } from "./response-poster.js";
import type { SetupResult } from "./setup-validator.js";
import type { WatchLogger } from "./watch-logger.js";

const STALE_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const MAX_CONVERSATION_HISTORY = 10;

/**
 * Process a single new issue: brainstorm -> post response -> set status
 * Checks for existing bot comments to avoid duplicate responses on --force restarts
 */
export async function processNewIssue(
	issue: GitHubIssue,
	state: WatchState,
	config: WatchConfig,
	setup: SetupResult,
	options: WatchCommandOptions,
	watchLog: WatchLogger,
	stats: WatchStats,
	projectDir: string,
): Promise<void> {
	const numStr = String(issue.number);
	watchLog.info(`Processing issue #${issue.number}: ${issue.title}`);

	// Check for existing bot comments to prevent duplicates on --force restarts
	const allComments = await getAllComments(setup.repoOwner, setup.repoName, issue.number);
	const latestCommentId =
		allComments.length > 0 ? allComments[allComments.length - 1].id : undefined;
	const hasBotComment = allComments.some((c) => isOwnComment(c.body));

	if (hasBotComment) {
		watchLog.info(`Bot already commented on #${issue.number}, resuming as clarifying`);
		// Rebuild conversation history from existing comments
		const history: string[] = [];
		for (const c of allComments) {
			if (isOwnComment(c.body)) {
				history.push(`AI: ${c.body}`);
			} else {
				history.push(`User: ${c.body}`);
			}
		}
		state.activeIssues[numStr] = {
			status: "clarifying",
			turnsUsed: history.filter((h) => h.startsWith("AI:")).length,
			createdAt: new Date().toISOString(),
			title: issue.title,
			conversationHistory: history.slice(-MAX_CONVERSATION_HISTORY),
			lastCommentId: latestCommentId,
		};

		// If last non-bot comment is from a user, re-evaluate readiness
		const lastUserComment = allComments.filter((c) => !isOwnComment(c.body)).pop();
		if (lastUserComment) {
			const lastBotComment = allComments.filter((c) => isOwnComment(c.body)).pop();
			const userRepliedAfterBot =
				lastBotComment && new Date(lastUserComment.createdAt) > new Date(lastBotComment.createdAt);

			if (userRepliedAfterBot) {
				watchLog.info(`User replied after bot on #${issue.number}, re-evaluating`);
				const stubIssue: GitHubIssue = {
					number: issue.number,
					title: issue.title,
					body: issue.body,
					author: issue.author,
					createdAt: issue.createdAt,
					updatedAt: issue.updatedAt,
					labels: issue.labels,
					state: issue.state,
				};
				const result = await invokeClaude({
					prompt: buildClarificationPrompt(
						stubIssue,
						`${setup.repoOwner}/${setup.repoName}`,
						state.activeIssues[numStr].conversationHistory,
						lastUserComment.body,
					),
					timeoutSec: config.timeouts.brainstormSec,
					maxTurns: 200,
					cwd: projectDir,
					dryRun: options.dryRun,
				});

				state.activeIssues[numStr].conversationHistory.push(`AI: ${result.response}`);

				await postResponse(
					setup.repoOwner,
					setup.repoName,
					issue.number,
					result.response,
					config.showBranding,
					options.dryRun,
				);

				// Update lastCommentId after posting
				const freshComments = await getAllComments(setup.repoOwner, setup.repoName, issue.number);
				if (freshComments.length > 0) {
					state.activeIssues[numStr].lastCommentId = freshComments[freshComments.length - 1].id;
				}

				if (result.readyForPlan) {
					await handlePlanGeneration(
						stubIssue,
						state,
						config,
						setup,
						options,
						watchLog,
						stats,
						projectDir,
					);
				}
			}
		}
		return;
	}

	state.activeIssues[numStr] = {
		status: "brainstorming",
		turnsUsed: 1,
		createdAt: new Date().toISOString(),
		title: issue.title,
		conversationHistory: [],
	};

	const result = await invokeClaude({
		prompt: buildBrainstormPrompt(
			issue,
			`${setup.repoOwner}/${setup.repoName}`,
			setup.skillsAvailable,
		),
		timeoutSec: config.timeouts.brainstormSec,
		maxTurns: 200,
		cwd: projectDir,
		dryRun: options.dryRun,
	});

	state.activeIssues[numStr].conversationHistory.push(`AI: ${result.response}`);

	const posted = await postResponse(
		setup.repoOwner,
		setup.repoName,
		issue.number,
		result.response,
		config.showBranding,
		options.dryRun,
	);

	if (!posted) {
		watchLog.warn(`Response blocked for #${issue.number} (credential scan)`);
		state.activeIssues[numStr].status = "error";
		stats.errors++;
		return;
	}

	// Set lastCommentId to prevent checkActiveIssues from replaying old comments
	const freshComments = await getAllComments(setup.repoOwner, setup.repoName, issue.number);
	if (freshComments.length > 0) {
		state.activeIssues[numStr].lastCommentId = freshComments[freshComments.length - 1].id;
	}

	stats.issuesProcessed++;

	if (result.readyForPlan) {
		await handlePlanGeneration(issue, state, config, setup, options, watchLog, stats, projectDir);
	} else {
		state.activeIssues[numStr].status = "clarifying";
		watchLog.info(`Issue #${issue.number} needs clarification`);
	}
}

/**
 * Generate and post an implementation plan for an issue
 */
export async function handlePlanGeneration(
	issue: GitHubIssue,
	state: WatchState,
	config: WatchConfig,
	setup: SetupResult,
	options: WatchCommandOptions,
	watchLog: WatchLogger,
	stats: WatchStats,
	projectDir: string,
): Promise<void> {
	const numStr = String(issue.number);
	state.activeIssues[numStr].status = "planning";
	watchLog.info(`Generating plan for #${issue.number}`);

	const planResult = await invokePlanGeneration({
		issue,
		repoName: `${setup.repoOwner}/${setup.repoName}`,
		conversationHistory: state.activeIssues[numStr].conversationHistory,
		timeoutSec: config.timeouts.planSec,
		maxTurns: 200,
		cwd: projectDir,
		dryRun: options.dryRun,
	});

	const posted = await postResponse(
		setup.repoOwner,
		setup.repoName,
		issue.number,
		planResult.planText,
		config.showBranding,
		options.dryRun,
	);

	if (posted) {
		stats.plansCreated++;

		// Try to find the plan directory created by /ck:plan skill on disk
		const detectedPlanDir = await findRecentPlanDir(projectDir, issue.number, watchLog);

		if (detectedPlanDir) {
			// /ck:plan created a proper plan directory with phases
			state.activeIssues[numStr].planPath = join(detectedPlanDir, "plan.md");
			watchLog.info(`Plan directory detected: ${detectedPlanDir}`);
		} else {
			// Fallback: save raw response text to plans/watch/
			try {
				const planDir = join(projectDir, "plans", "watch");
				await mkdir(planDir, { recursive: true });
				const planFilePath = join(planDir, `issue-${issue.number}-plan.md`);
				await writeFile(planFilePath, planResult.planText, "utf-8");
				state.activeIssues[numStr].planPath = planFilePath;
				watchLog.info(`Plan saved (fallback) to ${planFilePath}`);
			} catch (err) {
				watchLog.warn(
					`Could not save plan file for #${issue.number}: ${err instanceof Error ? err.message : "Unknown"}`,
				);
			}
		}

		// Transition to awaiting_approval — owner must confirm before implementation
		state.activeIssues[numStr].status = "awaiting_approval";
		watchLog.info(`Plan posted for #${issue.number}, awaiting owner approval`);

		// Post follow-up requesting approval (raw post to preserve @mention)
		const approvalPrompt = `Plan is ready. @${setup.repoOwner} — reply to confirm if you'd like me to implement this.`;
		await postRawResponse(
			setup.repoOwner,
			setup.repoName,
			issue.number,
			approvalPrompt,
			config.showBranding,
			options.dryRun,
		);
	} else {
		state.activeIssues[numStr].status = "error";
		stats.errors++;
	}
}

/**
 * Check active issues for new comments, stale timeout, and max turns
 */
export async function checkActiveIssues(
	state: WatchState,
	config: WatchConfig,
	setup: SetupResult,
	options: WatchCommandOptions,
	watchLog: WatchLogger,
	stats: WatchStats,
	projectDir: string,
	maintainerLogins: string[] = [],
): Promise<void> {
	for (const [numStr, issueState] of Object.entries(state.activeIssues)) {
		const num = Number(numStr);

		// Stale issue check (>24h no activity in clarifying)
		if (issueState.status === "clarifying") {
			const lastActivity = new Date(issueState.createdAt).getTime();
			if (Date.now() - lastActivity > STALE_TIMEOUT_MS) {
				watchLog.info(`Issue #${num} stale (>24h), marking completed`);
				issueState.status = "completed";
				state.processedIssues.push({ issueNumber: num, processedAt: new Date().toISOString() });
				continue;
			}
		}

		// Max turns check
		if (issueState.turnsUsed >= config.maxTurnsPerIssue) {
			watchLog.info(`Issue #${num} reached max turns (${config.maxTurnsPerIssue})`);
			issueState.status = "completed";
			state.processedIssues.push({ issueNumber: num, processedAt: new Date().toISOString() });
			continue;
		}

		// awaiting_approval is handled separately in checkAwaitingApproval
		if (issueState.status !== "clarifying") continue;

		const newComments = await pollComments(
			setup.repoOwner,
			setup.repoName,
			num,
			issueState.lastCommentId,
			maintainerLogins,
		);

		for (const comment of newComments) {
			if (isOwnComment(comment.body)) continue;

			issueState.turnsUsed++;
			issueState.conversationHistory.push(`User: ${comment.body}`);

			if (issueState.conversationHistory.length > MAX_CONVERSATION_HISTORY) {
				issueState.conversationHistory = issueState.conversationHistory.slice(
					-MAX_CONVERSATION_HISTORY,
				);
			}

			const stubIssue: GitHubIssue = {
				number: num,
				title: issueState.title,
				body: null,
				author: { login: "" },
				createdAt: "",
				updatedAt: "",
				labels: [],
				state: "open",
			};

			const result = await invokeClaude({
				prompt: buildClarificationPrompt(
					stubIssue,
					`${setup.repoOwner}/${setup.repoName}`,
					issueState.conversationHistory,
					comment.body,
				),
				timeoutSec: config.timeouts.brainstormSec,
				maxTurns: 200,
				cwd: projectDir,
				dryRun: options.dryRun,
			});

			issueState.conversationHistory.push(`AI: ${result.response}`);

			await postResponse(
				setup.repoOwner,
				setup.repoName,
				num,
				result.response,
				config.showBranding,
				options.dryRun,
			);
			issueState.lastCommentId = comment.id;

			if (result.readyForPlan) {
				await handlePlanGeneration(
					stubIssue,
					state,
					config,
					setup,
					options,
					watchLog,
					stats,
					projectDir,
				);
				break;
			}
		}
	}

	// Check awaiting_approval issues for owner replies
	await checkAwaitingApproval(state, setup, options, watchLog, projectDir);
}
