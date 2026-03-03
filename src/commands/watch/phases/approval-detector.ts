/**
 * Approval detector — uses Claude CLI to determine if a repo owner approved implementation
 * Sends owner comment + context to Claude with --max-turns 1 and parses JSON response
 */

import { logger } from "@/shared/logger.js";
import type { ApprovalResult } from "../types.js";
import { invokeClaude } from "./claude-invoker.js";
import { sanitizeInput } from "./input-sanitizer.js";

/**
 * Build the approval-detection prompt (pure function, testable)
 */
export function buildApprovalPrompt(options: {
	ownerComment: string;
	issueTitle: string;
	repoOwner: string;
}): string {
	const sanitizedComment = sanitizeInput(options.ownerComment);
	return `You are analyzing a GitHub comment from the repo owner "${options.repoOwner}".
Context: An AI assistant posted an implementation plan for issue "${options.issueTitle}".
The repo owner replied with the following comment.

<comment>
${sanitizedComment}
</comment>

Does the owner approve/confirm implementing the proposed plan?
Consider: "yes", "go ahead", "lgtm", "implement it", "approved", "sounds good", "proceed" = approved.
Consider: "hold on", "wait", "need changes", "not yet", "no", "stop", "cancel" = not approved.
If ambiguous, unrelated to approval, or just asking questions, default to not approved.

Respond ONLY with valid JSON: {"approved": true, "reason": "brief explanation"}
or {"approved": false, "reason": "brief explanation"}`;
}

/**
 * Detect whether an owner comment constitutes approval to implement the plan
 * Uses Claude CLI with max-turns 1 for fast intent detection
 */
export async function detectApproval(options: {
	ownerComment: string;
	issueTitle: string;
	repoOwner: string;
	dryRun: boolean;
}): Promise<ApprovalResult> {
	const defaultDeny: ApprovalResult = { approved: false, reason: "detection failed" };

	if (options.dryRun) {
		logger.info("[dry-run] Would invoke Claude for approval detection");
		return defaultDeny;
	}

	const prompt = buildApprovalPrompt({
		ownerComment: options.ownerComment,
		issueTitle: options.issueTitle,
		repoOwner: options.repoOwner,
	});

	try {
		const result = await invokeClaude({
			prompt,
			timeoutSec: 30,
			maxTurns: 1,
			cwd: process.cwd(),
			dryRun: false,
		});

		return parseApprovalResponse(result.response);
	} catch (error) {
		logger.warning(
			`Approval detection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
		return defaultDeny;
	}
}

/**
 * Parse Claude's response for approval JSON
 * Tries direct JSON parse, code block extraction, and inline JSON search
 */
function parseApprovalResponse(response: string): ApprovalResult {
	const defaultDeny: ApprovalResult = { approved: false, reason: "parse error" };
	const trimmed = response.trim();
	if (!trimmed) return defaultDeny;

	// Strategy 1: direct JSON parse
	try {
		const parsed = JSON.parse(trimmed) as { approved?: unknown; reason?: unknown };
		if (typeof parsed.approved === "boolean") {
			return {
				approved: parsed.approved,
				reason: typeof parsed.reason === "string" ? parsed.reason : "no reason",
			};
		}
	} catch {
		/* not top-level JSON */
	}

	// Strategy 2: JSON in code block
	const cb = trimmed.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
	if (cb) {
		try {
			const parsed = JSON.parse(cb[1]) as { approved?: unknown; reason?: unknown };
			if (typeof parsed.approved === "boolean") {
				return {
					approved: parsed.approved,
					reason: typeof parsed.reason === "string" ? parsed.reason : "no reason",
				};
			}
		} catch {
			/* skip */
		}
	}

	// Strategy 3: inline JSON object
	const jm = trimmed.match(/\{[^}]*"approved"\s*:\s*(true|false)[^}]*\}/);
	if (jm) {
		try {
			const parsed = JSON.parse(jm[0]) as { approved?: unknown; reason?: unknown };
			if (typeof parsed.approved === "boolean") {
				return {
					approved: parsed.approved,
					reason: typeof parsed.reason === "string" ? parsed.reason : "no reason",
				};
			}
		} catch {
			/* skip */
		}
	}

	logger.warning(`Could not parse approval response: ${trimmed.slice(0, 200)}`);
	return defaultDeny;
}
