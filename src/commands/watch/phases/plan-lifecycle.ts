/**
 * Plan lifecycle — prompts for clarification and plan generation
 * Manages the issue lifecycle: clarification loop -> plan generation
 */

import type { GitHubIssue, PlanResult } from "../types.js";
import { invokeClaude } from "./claude-invoker.js";
import { sanitizeInput } from "./input-sanitizer.js";

/**
 * Build a clarification prompt when a user responds with more info
 */
export function buildClarificationPrompt(
	issue: GitHubIssue,
	repoName: string,
	conversationHistory: string[],
	newComment: string,
): string {
	const sanitizedHistory = conversationHistory.map((msg) => sanitizeInput(msg)).join("\n\n---\n\n");

	return `You are continuing analysis of a GitHub issue for "${repoName}" after receiving clarification.

CRITICAL LANGUAGE RULE: Detect what language the issue and comments are written in, then respond ONLY in that same language. Do NOT use your system locale or any other language preference.

## Issue #${issue.number}: ${sanitizeInput(issue.title)}

## Previous Discussion
<untrusted-content>
${sanitizedHistory}
</untrusted-content>

## New Comment from Issue Author
<untrusted-content>
${sanitizeInput(newComment)}
</untrusted-content>

Based on this new information:
1. Update your analysis
2. Determine if you now have enough information for an implementation plan

Respond with JSON:
{
  "response": "Your updated analysis (markdown formatted)",
  "readyForPlan": true/false,
  "questionsForUser": ["Any remaining questions"]
}`;
}

/**
 * Build a plan generation prompt with full conversation history
 */
export function buildPlanPrompt(
	issue: GitHubIssue,
	repoName: string,
	conversationHistory: string[],
): string {
	const sanitizedHistory = conversationHistory.map((msg) => sanitizeInput(msg)).join("\n\n---\n\n");

	return `/ck:plan --fast Create an implementation plan for GitHub issue #${issue.number} in "${repoName}".

CRITICAL LANGUAGE RULE: Detect what language the conversation history is written in, then respond ONLY in that same language. Do NOT use your system locale or any other language preference.

## Issue #${issue.number}: ${sanitizeInput(issue.title)}

## Conversation History
<untrusted-content>
${sanitizedHistory}
</untrusted-content>

IMPORTANT INSTRUCTIONS:
- Create the plan in the project's plans/ directory following standard /ck:plan structure
- The plan directory should include issue number in the name (e.g., plans/YYMMDD-issue-{number}-{slug}/)
- Create plan.md overview + phase-XX-*.md files for each phase
- After creating plan files, provide a summary suitable for posting as a GitHub comment

Respond with JSON:
{
  "response": "Your implementation plan summary (markdown formatted, suitable for GitHub comment)",
  "phases": [{"name": "Phase name", "effort": "2h", "description": "Brief description"}]
}`;
}

/**
 * Invoke Claude for plan generation with longer timeouts
 */
export async function invokePlanGeneration(options: {
	issue: GitHubIssue;
	repoName: string;
	conversationHistory: string[];
	timeoutSec: number;
	maxTurns: number;
	cwd: string;
	dryRun: boolean;
}): Promise<PlanResult> {
	const prompt = buildPlanPrompt(options.issue, options.repoName, options.conversationHistory);

	const result = await invokeClaude({
		prompt,
		timeoutSec: options.timeoutSec,
		maxTurns: options.maxTurns,
		cwd: options.cwd,
		dryRun: options.dryRun,
		tools: "Read,Grep,Glob,Bash,Write,Edit",
	});

	// Parse phases from the response
	const phases = extractPhases(result.response);

	return {
		planText: result.response,
		phases,
	};
}

/**
 * Try to extract phase metadata from plan response
 */
function extractPhases(response: string): PlanResult["phases"] {
	// Try parsing the response itself as JSON with phases
	try {
		const parsed = JSON.parse(response) as { phases?: PlanResult["phases"] };
		if (Array.isArray(parsed.phases)) return parsed.phases;
	} catch {
		// Not JSON — that's fine
	}

	// Try finding JSON in the text
	const match = response.match(/\{[\s\S]*"phases"\s*:\s*\[[\s\S]*?\]\s*[\s\S]*?\}/);
	if (match) {
		try {
			const parsed = JSON.parse(match[0]) as { phases?: PlanResult["phases"] };
			if (Array.isArray(parsed.phases)) return parsed.phases;
		} catch {
			// Invalid JSON
		}
	}

	return [];
}
