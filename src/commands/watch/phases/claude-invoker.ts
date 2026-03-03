/**
 * Claude invoker — spawns `claude -p` with sandboxed permissions
 * Content passed via stdin only (never command args) for security
 */

import { type ChildProcess, spawn } from "node:child_process";
import { logger } from "@/shared/logger.js";
import type { ClaudeResult, GitHubIssue } from "../types.js";

/**
 * Invoke Claude CLI in print mode with security constraints
 * Returns parsed response or fallback to raw text
 */
export async function invokeClaude(options: {
	prompt: string;
	timeoutSec: number;
	maxTurns: number;
	cwd: string;
	dryRun: boolean;
}): Promise<ClaudeResult> {
	if (options.dryRun) {
		logger.info("[dry-run] Would invoke Claude with prompt");
		logger.verbose("Prompt preview:", { prompt: options.prompt.slice(0, 200) });
		return {
			response: "[dry-run] No Claude invocation",
			readyForPlan: false,
			questionsForUser: [],
		};
	}

	const args = [
		"-p",
		"--output-format",
		"json",
		"--max-turns",
		String(options.maxTurns),
		"--tools",
		"Read,Grep,Glob",
		"--allowedTools",
		"Read,Grep,Glob",
	];

	const child = spawn("claude", args, {
		cwd: options.cwd,
		stdio: ["pipe", "pipe", "pipe"],
		detached: false,
	});

	// Pass prompt via stdin (never as command arg)
	child.stdin.write(options.prompt);
	child.stdin.end();

	return collectClaudeOutput(child, options.timeoutSec);
}

/**
 * Collect and parse Claude CLI output with timeout handling
 */
function collectClaudeOutput(child: ChildProcess, timeoutSec: number): Promise<ClaudeResult> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		const stderrChunks: Buffer[] = [];

		child.stdout?.on("data", (chunk: Buffer) => chunks.push(chunk));
		child.stderr?.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

		// Timeout: SIGTERM then SIGKILL after 5s grace
		const timeout = setTimeout(() => {
			logger.warning(`Claude process timed out after ${timeoutSec}s`);
			child.kill("SIGTERM");
			setTimeout(() => {
				if (!child.killed) child.kill("SIGKILL");
			}, 5000);
		}, timeoutSec * 1000);

		child.on("error", (err) => {
			clearTimeout(timeout);
			reject(new Error(`Failed to spawn claude: ${err.message}`));
		});

		child.on("close", (code) => {
			clearTimeout(timeout);
			const stdout = Buffer.concat(chunks).toString("utf-8");

			if (code !== 0 && !stdout.trim()) {
				const stderr = Buffer.concat(stderrChunks).toString("utf-8");
				reject(new Error(`Claude exited with code ${code}: ${stderr}`));
				return;
			}

			resolve(parseClaudeOutput(stdout));
		});
	});
}

/**
 * Build the brainstorm analysis prompt for a GitHub issue
 */
export function buildBrainstormPrompt(
	issue: GitHubIssue,
	repoName: string,
	_skillsAvailable: boolean,
): string {
	return `You are analyzing a GitHub issue for the project "${repoName}".

## Issue #${issue.number}: ${issue.title}

<untrusted-content>
${issue.body ?? ""}
</untrusted-content>

Analyze this issue. Identify:
1. What the user wants to achieve
2. Key technical requirements
3. Potential approaches with trade-offs
4. Questions needing clarification before implementation

Respond with a JSON object:
{
  "response": "Your analysis and response text (markdown formatted)",
  "readyForPlan": false,
  "questionsForUser": ["Question 1?", "Question 2?"]
}

If you have enough information for a full implementation plan, set readyForPlan to true and questionsForUser to [].`;
}

/**
 * Parse Claude -p JSON output with multiple fallback strategies
 */
export function parseClaudeOutput(stdout: string): ClaudeResult {
	const fallback: ClaudeResult = {
		response: stdout.trim(),
		readyForPlan: false,
		questionsForUser: [],
	};
	if (!stdout.trim()) return fallback;

	// Strategy 1: Direct JSON parse (claude --output-format json wraps in { result })
	try {
		const parsed = JSON.parse(stdout);
		const text = typeof parsed === "string" ? parsed : (parsed.result ?? parsed.response ?? stdout);
		const inner = typeof text === "string" ? text : JSON.stringify(text);
		try {
			return toClaudeResult(JSON.parse(inner));
		} catch {
			/* not JSON */
		}
		const m = inner.match(/\{[\s\S]*"response"[\s\S]*\}/);
		if (m)
			try {
				return toClaudeResult(JSON.parse(m[0]));
			} catch {
				/* skip */
			}
		return { response: inner, readyForPlan: false, questionsForUser: [] };
	} catch {
		/* not top-level JSON */
	}

	// Strategy 2: JSON in markdown code block
	const cb = stdout.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
	if (cb)
		try {
			return toClaudeResult(JSON.parse(cb[1]));
		} catch {
			/* skip */
		}

	// Strategy 3: JSON object boundaries
	const jm = stdout.match(/\{[\s\S]*"response"[\s\S]*\}/);
	if (jm)
		try {
			return toClaudeResult(JSON.parse(jm[0]));
		} catch {
			/* skip */
		}

	return fallback;
}

/** Normalize parsed JSON to ClaudeResult */
function toClaudeResult(parsed: unknown): ClaudeResult {
	if (!parsed || typeof parsed !== "object") {
		return { response: String(parsed), readyForPlan: false, questionsForUser: [] };
	}
	const obj = parsed as Record<string, unknown>;
	return {
		response: typeof obj.response === "string" ? obj.response : JSON.stringify(parsed),
		readyForPlan: obj.readyForPlan === true,
		questionsForUser: Array.isArray(obj.questionsForUser) ? (obj.questionsForUser as string[]) : [],
	};
}
