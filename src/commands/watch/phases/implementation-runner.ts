/**
 * Implementation runner — orchestrates branch creation, Claude CLI execution, push, and PR
 * Steps: detect default branch → create branch → invoke Claude → push → PR → post comment → restore
 * Git operations are delegated to implementation-git-helpers.ts
 */

import { spawn } from "node:child_process";
import { logger } from "@/shared/logger.js";
import {
	createIssueBranch,
	detectDefaultBranch,
	getCurrentBranch,
	pushAndCreatePr,
	restoreOriginalBranch,
} from "./implementation-git-helpers.js";
import { postResponse } from "./response-poster.js";

export interface ImplementationResult {
	success: boolean;
	branchName: string;
	prUrl: string | null;
	error: string | null;
}

/**
 * Run a full auto-implementation cycle for a single issue
 * Creates branch, invokes Claude with the plan, pushes, creates PR, posts update
 */
export async function runImplementation(options: {
	issueNumber: number;
	issueTitle: string;
	planPath: string;
	repoOwner: string;
	repoName: string;
	timeoutSec: number;
	cwd: string;
	dryRun: boolean;
	showBranding: boolean;
	worktreeEnabled?: boolean;
	worktreeBaseBranch?: string;
	worktreeAutoCleanup?: boolean;
}): Promise<ImplementationResult> {
	const { issueNumber, issueTitle, planPath, repoOwner, repoName, cwd, dryRun } = options;

	let originalBranch = "main";
	let branchName = `ck-watch/issue-${issueNumber}`;

	if (dryRun) {
		logger.info(`[dry-run] Would implement issue #${issueNumber} on branch ${branchName}`);
		logger.info(`[dry-run] Plan: ${planPath}`);
		return { success: true, branchName, prUrl: null, error: null };
	}

	// Worktree path: Claude runs inside isolated worktree, skipping stash/checkout/restore
	if (options.worktreeEnabled) {
		const { createWorktree, removeWorktree, ensureGitignore } = await import(
			"./worktree-manager.js"
		);
		await ensureGitignore(cwd);
		const worktreePath = await createWorktree(
			cwd,
			issueNumber,
			options.worktreeBaseBranch ?? "main",
		);
		branchName = `ck-watch/issue-${issueNumber}`;

		try {
			await invokeImplementation({
				issueNumber,
				issueTitle,
				planPath,
				timeoutSec: options.timeoutSec,
				cwd: worktreePath,
			});
			logger.info(`[impl] Claude implementation complete for #${issueNumber} (worktree)`);

			const prUrl = await pushAndCreatePr({
				branchName,
				defaultBranch: options.worktreeBaseBranch ?? "main",
				issueNumber,
				issueTitle,
				planPath,
				cwd: worktreePath,
			});
			logger.info(`[impl] PR created: ${prUrl}`);

			await postResponse(
				repoOwner,
				repoName,
				issueNumber,
				`Implementation complete! PR created: ${prUrl}`,
				options.showBranding,
				false,
			);

			return { success: true, branchName, prUrl, error: null };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			logger.error(`[impl] Implementation failed for #${issueNumber}: ${message}`);
			await postResponse(
				repoOwner,
				repoName,
				issueNumber,
				`Auto-implementation encountered an error:\n\n\`\`\`\n${message}\n\`\`\`\n\nBranch \`${branchName}\` may have partial work.`,
				options.showBranding,
				false,
			).catch(() => {});
			return { success: false, branchName, prUrl: null, error: message };
		} finally {
			if (options.worktreeAutoCleanup !== false) {
				await removeWorktree(cwd, issueNumber).catch(() => {});
			}
		}
	}

	// Standard path: stash/checkout/restore (unchanged)
	try {
		originalBranch = await getCurrentBranch(cwd);
		logger.info(`[impl] Current branch: ${originalBranch}`);

		const defaultBranch = await detectDefaultBranch(cwd);
		logger.info(`[impl] Default branch: ${defaultBranch}`);

		branchName = await createIssueBranch(issueNumber, defaultBranch, cwd);
		logger.info(`[impl] Created branch: ${branchName}`);

		await invokeImplementation({
			issueNumber,
			issueTitle,
			planPath,
			timeoutSec: options.timeoutSec,
			cwd,
		});
		logger.info(`[impl] Claude implementation complete for #${issueNumber}`);

		const prUrl = await pushAndCreatePr({
			branchName,
			defaultBranch,
			issueNumber,
			issueTitle,
			planPath,
			cwd,
		});
		logger.info(`[impl] PR created: ${prUrl}`);

		await postResponse(
			repoOwner,
			repoName,
			issueNumber,
			`Implementation complete! PR created: ${prUrl}`,
			options.showBranding,
			false,
		);

		return { success: true, branchName, prUrl, error: null };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logger.error(`[impl] Implementation failed for #${issueNumber}: ${message}`);

		await postResponse(
			repoOwner,
			repoName,
			issueNumber,
			`Auto-implementation encountered an error:\n\n\`\`\`\n${message}\n\`\`\`\n\nBranch \`${branchName}\` may have partial work.`,
			options.showBranding,
			false,
		).catch(() => {
			/* non-critical */
		});

		return { success: false, branchName, prUrl: null, error: message };
	} finally {
		await restoreOriginalBranch(originalBranch, cwd, issueNumber);
	}
}

/**
 * Invoke Claude CLI to implement the plan and commit the result
 * Uses full tool access (Read,Grep,Glob,Bash,Write,Edit) and extended timeout
 */
async function invokeImplementation(options: {
	issueNumber: number;
	issueTitle: string;
	planPath: string;
	timeoutSec: number;
	cwd: string;
}): Promise<void> {
	const { issueNumber, issueTitle, planPath, timeoutSec, cwd } = options;

	const prompt = `/ck:cook --auto ${planPath}

After completing the implementation:
1. Stage all changes: git add -A
2. Commit with message: feat: implement #${issueNumber} - ${issueTitle}
3. Do NOT push yet — the runner will handle push and PR creation.`;

	const tools = "Read,Grep,Glob,Bash,Write,Edit";
	const args = [
		"-p",
		"--output-format",
		"text",
		"--max-turns",
		"200",
		"--tools",
		tools,
		"--allowedTools",
		tools,
	];

	await new Promise<void>((resolve, reject) => {
		const child = spawn("claude", args, { cwd, stdio: ["pipe", "pipe", "pipe"], detached: false });
		child.stdin.write(prompt);
		child.stdin.end();

		const stderrChunks: Buffer[] = [];
		child.stderr?.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

		const timer = setTimeout(() => {
			logger.warning(`[impl] Claude timed out after ${timeoutSec}s`);
			child.kill("SIGTERM");
			setTimeout(() => {
				if (!child.killed) child.kill("SIGKILL");
			}, 5000);
		}, timeoutSec * 1000);

		child.on("error", (err) => {
			clearTimeout(timer);
			reject(new Error(`spawn claude: ${err.message}`));
		});
		child.on("close", (code) => {
			clearTimeout(timer);
			if (code !== 0) {
				const stderr = Buffer.concat(stderrChunks).toString("utf-8");
				reject(new Error(`Claude exited ${code}: ${stderr.slice(0, 500)}`));
				return;
			}
			resolve();
		});
	});
}
