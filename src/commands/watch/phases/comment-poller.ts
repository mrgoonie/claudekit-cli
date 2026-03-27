/**
 * Comment poller — polls GitHub API for new comments on active issues
 * Detects own comments via HTML marker to prevent infinite reply loops
 */

import { spawn } from "node:child_process";
import { logger } from "@/shared/logger.js";

export interface NewComment {
	id: number;
	body: string;
	author: string;
	createdAt: string;
}

const AI_DISCLAIMER = "<!-- ck-watch-bot -->";

/**
 * Poll comments on a specific issue, returning only new comments
 */
export async function pollComments(
	owner: string,
	repo: string,
	issueNumber: number,
	lastCommentId: number | undefined,
	maintainerLogins?: string[],
): Promise<NewComment[]> {
	const args = [
		"api",
		`repos/${owner}/${repo}/issues/${issueNumber}/comments`,
		"--jq",
		"[.[] | {id: .id, body: .body, author: .user.login, createdAt: .created_at}]",
	];

	try {
		const stdout = await spawnAndCollect("gh", args);
		if (!stdout.trim()) return [];

		const comments = JSON.parse(stdout) as NewComment[];

		// Filter to only new comments (after lastCommentId)
		let filtered = comments;
		if (lastCommentId !== undefined) {
			filtered = comments.filter((c) => c.id > lastCommentId);
		}

		// Skip own comments
		const nonBot = filtered.filter((c) => !isOwnComment(c.body));

		// Skip turn if last comment is from a maintainer
		if (maintainerLogins?.length && nonBot.length > 0) {
			const lastComment = nonBot[nonBot.length - 1];
			if (maintainerLogins.includes(lastComment.author.toLowerCase())) {
				return []; // maintainer replied, skip this turn
			}
		}

		return nonBot;
	} catch (error) {
		logger.warning(
			`Failed to poll comments for #${issueNumber}: ${error instanceof Error ? error.message : "Unknown"}`,
		);
		return [];
	}
}

/**
 * Get ALL comments on an issue (including bot comments)
 * Used for dedup detection and conversation reconstruction
 */
export async function getAllComments(
	owner: string,
	repo: string,
	issueNumber: number,
): Promise<NewComment[]> {
	const args = [
		"api",
		`repos/${owner}/${repo}/issues/${issueNumber}/comments`,
		"--jq",
		"[.[] | {id: .id, body: .body, author: .user.login, createdAt: .created_at}]",
	];

	try {
		const stdout = await spawnAndCollect("gh", args);
		if (!stdout.trim()) return [];
		return JSON.parse(stdout) as NewComment[];
	} catch (error) {
		logger.warning(
			`Failed to get all comments for #${issueNumber}: ${error instanceof Error ? error.message : "Unknown"}`,
		);
		return [];
	}
}

/**
 * Detect own comments by the hidden HTML marker
 */
export function isOwnComment(body: string): boolean {
	return body.includes(AI_DISCLAIMER);
}

/**
 * Get the AI disclaimer marker for response formatting
 */
export function getDisclaimerMarker(): string {
	return AI_DISCLAIMER;
}

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
