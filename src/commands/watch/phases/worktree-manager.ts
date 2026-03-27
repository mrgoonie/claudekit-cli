/**
 * Worktree manager — creates/removes git worktrees for issue isolation
 * Each issue gets its own worktree under .worktrees/issue-{N}
 * Default behavior: disabled. Enabled via config.worktree.enabled = true
 */

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "@/shared/logger.js";
import { spawnAndCollect } from "./implementation-git-helpers.js";

const WORKTREE_DIR = ".worktrees";

/**
 * Create a git worktree for an issue
 * Returns the absolute path to the worktree directory
 */
export async function createWorktree(
	projectDir: string,
	issueNumber: number,
	baseBranch: string,
): Promise<string> {
	const worktreePath = join(projectDir, WORKTREE_DIR, `issue-${issueNumber}`);
	const branchName = `ck-watch/issue-${issueNumber}`;

	// Fetch latest base branch (best-effort)
	await spawnAndCollect("git", ["fetch", "origin", baseBranch], projectDir).catch(() => {
		logger.warning(`[worktree] Could not fetch origin/${baseBranch}, using local`);
	});

	try {
		// Try creating new worktree with new branch
		await spawnAndCollect(
			"git",
			["worktree", "add", worktreePath, "-b", branchName, `origin/${baseBranch}`],
			projectDir,
		);
	} catch {
		// Branch may already exist — try reusing it
		try {
			await spawnAndCollect("git", ["worktree", "add", worktreePath, branchName], projectDir);
		} catch (err) {
			throw new Error(
				`Failed to create worktree for issue #${issueNumber}: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	logger.info(`[worktree] Created: ${worktreePath} (branch: ${branchName})`);
	return worktreePath;
}

/**
 * Remove a worktree and its branch
 */
export async function removeWorktree(projectDir: string, issueNumber: number): Promise<void> {
	const worktreePath = join(projectDir, WORKTREE_DIR, `issue-${issueNumber}`);
	const branchName = `ck-watch/issue-${issueNumber}`;

	try {
		await spawnAndCollect("git", ["worktree", "remove", worktreePath, "--force"], projectDir);
		logger.info(`[worktree] Removed: ${worktreePath}`);
	} catch (err) {
		logger.warning(
			`[worktree] Could not remove ${worktreePath}: ${err instanceof Error ? err.message : "Unknown"}`,
		);
	}

	// Best-effort branch cleanup (may already be merged/deleted)
	await spawnAndCollect("git", ["branch", "-D", branchName], projectDir).catch(() => {});
}

/**
 * List active worktree issue numbers by parsing git porcelain output
 */
export async function listActiveWorktrees(projectDir: string): Promise<number[]> {
	try {
		const output = await spawnAndCollect("git", ["worktree", "list", "--porcelain"], projectDir);
		const issueNumbers: number[] = [];
		const worktreePrefix = join(projectDir, WORKTREE_DIR, "issue-").replace(/\\/g, "/");

		for (const line of output.split("\n")) {
			if (line.startsWith("worktree ")) {
				const path = line.slice(9).replace(/\\/g, "/");
				if (path.startsWith(worktreePrefix)) {
					const num = Number.parseInt(path.slice(worktreePrefix.length), 10);
					if (!Number.isNaN(num)) issueNumbers.push(num);
				}
			}
		}
		return issueNumbers;
	} catch {
		return [];
	}
}

/**
 * Remove all ck-watch worktrees (startup cleanup + graceful shutdown)
 */
export async function cleanupAllWorktrees(projectDir: string): Promise<void> {
	const issues = await listActiveWorktrees(projectDir);
	if (issues.length === 0) return;

	logger.info(`[worktree] Cleaning up ${issues.length} orphan worktree(s)...`);
	for (const issueNumber of issues) {
		await removeWorktree(projectDir, issueNumber);
	}
	// Prune stale worktree metadata
	await spawnAndCollect("git", ["worktree", "prune"], projectDir).catch(() => {});
}

/**
 * Ensure .worktrees/ is listed in .gitignore
 */
export async function ensureGitignore(projectDir: string): Promise<void> {
	const gitignorePath = join(projectDir, ".gitignore");
	try {
		const content = existsSync(gitignorePath) ? await readFile(gitignorePath, "utf-8") : "";
		if (!content.includes(".worktrees")) {
			const newContent = content.endsWith("\n")
				? `${content}.worktrees/\n`
				: `${content}\n.worktrees/\n`;
			await writeFile(gitignorePath, newContent, "utf-8");
			logger.info("[worktree] Added .worktrees/ to .gitignore");
		}
	} catch (err) {
		logger.warning(
			`[worktree] Could not update .gitignore: ${err instanceof Error ? err.message : "Unknown"}`,
		);
	}
}
