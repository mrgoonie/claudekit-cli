/**
 * Git helpers for implementation runner
 * Handles branch detection, creation, push, PR creation, and branch restore
 */

import { spawn } from "node:child_process";
import { logger } from "@/shared/logger.js";

/**
 * Get the current git branch name
 */
export async function getCurrentBranch(cwd: string): Promise<string> {
	const output = await spawnAndCollect("git", ["rev-parse", "--abbrev-ref", "HEAD"], cwd);
	return output.trim() || "main";
}

/**
 * Detect the repository default branch via gh CLI
 */
export async function detectDefaultBranch(cwd: string): Promise<string> {
	try {
		const output = await spawnAndCollect(
			"gh",
			["repo", "view", "--json", "defaultBranchRef", "--jq", ".defaultBranchRef.name"],
			cwd,
		);
		return output.trim() || "main";
	} catch {
		logger.warning("[impl] Could not detect default branch, falling back to 'main'");
		return "main";
	}
}

/**
 * Create a branch for the issue from the default branch
 * Stashes uncommitted changes if the working tree is dirty before switching.
 * If branch already exists, appends a timestamp suffix.
 */
export async function createIssueBranch(
	issueNumber: number,
	defaultBranch: string,
	cwd: string,
): Promise<string> {
	// Check for uncommitted changes and stash if dirty
	const status = await spawnAndCollect("git", ["status", "--porcelain"], cwd);
	if (status.trim()) {
		const stashMessage = `ck-watch-auto-stash-issue-${issueNumber}`;
		await spawnAndCollect("git", ["stash", "push", "-m", stashMessage], cwd);
		logger.info(`[impl] Stashed uncommitted changes before branch switch (issue #${issueNumber})`);
	}

	const baseName = `ck-watch/issue-${issueNumber}`;

	await spawnAndCollect("git", ["fetch", "origin", defaultBranch], cwd).catch(() => {
		logger.warning(`[impl] Could not fetch origin/${defaultBranch}, using local`);
	});

	try {
		await spawnAndCollect("git", ["checkout", "-b", baseName, `origin/${defaultBranch}`], cwd);
		return baseName;
	} catch {
		// Branch likely already exists — append timestamp
		const timestamp = Math.floor(Date.now() / 1000);
		const branchName = `${baseName}-${timestamp}`;
		await spawnAndCollect("git", ["checkout", "-b", branchName, `origin/${defaultBranch}`], cwd);
		return branchName;
	}
}

/**
 * Push the branch and create a pull request via gh CLI
 * Returns the PR URL
 */
export async function pushAndCreatePr(options: {
	branchName: string;
	defaultBranch: string;
	issueNumber: number;
	issueTitle: string;
	planPath: string;
	cwd: string;
}): Promise<string> {
	const { branchName, defaultBranch, issueNumber, issueTitle, planPath, cwd } = options;

	await spawnAndCollect("git", ["push", "-u", "origin", branchName], cwd);

	const prTitle = `feat: #${issueNumber} - ${issueTitle}`;
	const prBody = `Closes #${issueNumber}\n\n## Auto-implemented by ClaudeKit Watch\n\nPlan: ${planPath}`;

	const prUrl = await spawnAndCollect(
		"gh",
		[
			"pr",
			"create",
			"--title",
			prTitle,
			"--body",
			prBody,
			"--base",
			defaultBranch,
			"--head",
			branchName,
		],
		cwd,
	);

	return prUrl.trim();
}

/**
 * Restore the original git branch — always runs in finally block.
 * Pops the auto-stash created by createIssueBranch if present.
 */
export async function restoreOriginalBranch(
	branchName: string,
	cwd: string,
	issueNumber?: number,
): Promise<void> {
	try {
		await spawnAndCollect("git", ["checkout", branchName], cwd);
		logger.info(`[impl] Restored branch: ${branchName}`);

		// Pop stash if one was created for this issue
		if (issueNumber !== undefined) {
			const stashLabel = `ck-watch-auto-stash-issue-${issueNumber}`;
			const stashList = await spawnAndCollect("git", ["stash", "list"], cwd).catch(() => "");
			if (stashList.includes(stashLabel)) {
				await spawnAndCollect("git", ["stash", "pop"], cwd);
				logger.info(`[impl] Restored stashed changes for issue #${issueNumber}`);
			}
		}
	} catch (error) {
		logger.warning(
			`[impl] Could not restore branch '${branchName}': ${error instanceof Error ? error.message : "Unknown"}`,
		);
	}
}

/**
 * Spawn a command and collect its stdout as a string
 * Rejects on non-zero exit code
 */
export function spawnAndCollect(command: string, args: string[], cwd: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
		const chunks: Buffer[] = [];
		const stderrChunks: Buffer[] = [];

		child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
		child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

		child.on("error", (err) => reject(new Error(`Failed to spawn ${command}: ${err.message}`)));
		child.on("close", (code) => {
			if (code !== 0) {
				const stderr = Buffer.concat(stderrChunks).toString("utf-8");
				reject(new Error(`${command} ${args[0] ?? ""} exited with code ${code}: ${stderr}`));
				return;
			}
			resolve(Buffer.concat(chunks).toString("utf-8"));
		});
	});
}
