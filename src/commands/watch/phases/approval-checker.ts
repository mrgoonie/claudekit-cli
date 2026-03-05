/**
 * Approval checker — polls owner comments on awaiting_approval issues
 * Delegates intent detection to approval-detector.ts
 * Called from checkActiveIssues at the end of each poll cycle
 */

import type { WatchCommandOptions, WatchState } from "../types.js";
import { detectApproval } from "./approval-detector.js";
import { pollComments } from "./comment-poller.js";
import type { SetupResult } from "./setup-validator.js";
import type { WatchLogger } from "./watch-logger.js";

/**
 * Check issues in awaiting_approval status for owner approval comments
 * Enqueues approved issues for implementation
 */
export async function checkAwaitingApproval(
	state: WatchState,
	setup: SetupResult,
	options: WatchCommandOptions,
	watchLog: WatchLogger,
	projectDir: string,
): Promise<void> {
	for (const [numStr, issueState] of Object.entries(state.activeIssues)) {
		if (issueState.status !== "awaiting_approval") continue;

		const num = Number(numStr);
		const newComments = await pollComments(
			setup.repoOwner,
			setup.repoName,
			num,
			issueState.lastCommentId,
		);

		// Only owner comments can trigger approval
		const ownerComments = newComments.filter((c) => c.author === setup.repoOwner);
		if (ownerComments.length === 0) continue;

		// Update lastCommentId to latest seen
		const maxId = Math.max(...newComments.map((c) => c.id));
		issueState.lastCommentId = maxId;

		for (const comment of ownerComments) {
			const result = await detectApproval({
				ownerComment: comment.body,
				issueTitle: issueState.title,
				repoOwner: setup.repoOwner,
				dryRun: options.dryRun,
				cwd: projectDir,
			});

			if (result.approved) {
				watchLog.info(`Issue #${num} approved for implementation: ${result.reason}`);
				if (!state.implementationQueue.includes(num)) {
					state.implementationQueue.push(num);
				}
				issueState.status = "implementing";
				break; // first approval is sufficient
			}
			watchLog.info(`Issue #${num} approval not confirmed: ${result.reason}`);
		}
	}
}
