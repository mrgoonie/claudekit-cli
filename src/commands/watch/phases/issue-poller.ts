/**
 * Issue poller — polls GitHub for new issues via gh CLI
 * Filters bots, excludeAuthors, and already-processed issues
 */

import { spawn } from "node:child_process";
import { logger } from "@/shared/logger.js";
import { z } from "zod";
import { type GitHubIssue, GitHubIssueSchema } from "../types.js";

export interface PollResult {
	issues: GitHubIssue[];
	hasMore: boolean;
}

/**
 * Poll for new open issues from a GitHub repo
 * Returns issues sorted by createdAt ascending (oldest first)
 */
export async function pollNewIssues(
	owner: string,
	repo: string,
	lastCheckedAt: string | undefined,
	excludeAuthors: string[],
): Promise<PollResult> {
	const args = [
		"issue",
		"list",
		"--repo",
		`${owner}/${repo}`,
		"--json",
		"number,title,body,author,createdAt,labels,state",
		"--state",
		"open",
		"--limit",
		"20",
	];

	const stdout = await spawnAndCollect("gh", args);
	if (!stdout.trim()) {
		return { issues: [], hasMore: false };
	}

	let parsed: unknown[];
	try {
		parsed = JSON.parse(stdout) as unknown[];
	} catch {
		logger.warning("Failed to parse gh issue list output");
		return { issues: [], hasMore: false };
	}

	// Validate with Zod
	const validated = z.array(GitHubIssueSchema).safeParse(parsed);
	if (!validated.success) {
		logger.warning(`Issue schema validation failed: ${validated.error.message}`);
		return { issues: [], hasMore: false };
	}

	// Filter bots and excluded authors
	let issues = validated.data.filter((issue) => !isBot(issue.author.login, excludeAuthors));

	// Filter by createdAt if we have a checkpoint
	if (lastCheckedAt) {
		const checkpoint = new Date(lastCheckedAt).getTime();
		issues = issues.filter((issue) => new Date(issue.createdAt).getTime() > checkpoint);
	}

	// Sort oldest first
	issues.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

	return {
		issues,
		hasMore: parsed.length >= 20,
	};
}

/**
 * Detect bot accounts by [bot] suffix or excludeAuthors list
 */
export function isBot(login: string, excludeAuthors: string[]): boolean {
	return login.endsWith("[bot]") || excludeAuthors.includes(login);
}

/**
 * Check if rate limit allows more processing this hour
 */
export function checkRateLimit(processedThisHour: number, maxPerHour: number): boolean {
	return processedThisHour < maxPerHour;
}

/**
 * Spawn a process and collect stdout
 */
function spawnAndCollect(command: string, args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
		const chunks: Buffer[] = [];
		const stderrChunks: Buffer[] = [];

		child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
		child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

		child.on("error", (err) => reject(new Error(`Failed to spawn ${command}: ${err.message}`)));
		child.on("close", (code) => {
			if (code !== 0) {
				const stderr = Buffer.concat(stderrChunks).toString("utf-8");
				reject(new Error(`${command} exited with code ${code}: ${stderr}`));
				return;
			}
			resolve(Buffer.concat(chunks).toString("utf-8"));
		});
	});
}
