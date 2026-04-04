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
	verbose?: boolean;
	tools?: string;
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

	const verbose = options.verbose ?? logger.isVerbose();
	// Use JSON output in verbose mode for full turn-by-turn detail
	const outputFormat = verbose ? "stream-json" : "text";
	const tools = options.tools ?? "Read,Grep,Glob,Bash";
	const args = [
		"-p",
		"--output-format",
		outputFormat,
		"--max-turns",
		String(options.maxTurns),
		"--tools",
		tools,
		"--allowedTools",
		tools,
	];

	// Claude CLI requires --verbose when using -p --output-format stream-json
	if (outputFormat === "stream-json") {
		args.push("--verbose");
	}

	const child = spawn("claude", args, {
		cwd: options.cwd,
		stdio: ["pipe", "pipe", "pipe"],
		detached: false,
	});

	// Pass prompt via stdin (never as command arg)
	child.stdin.write(options.prompt);
	child.stdin.end();

	return collectClaudeOutput(child, options.timeoutSec, verbose);
}

/**
 * Collect and parse Claude CLI output with timeout handling
 */
function collectClaudeOutput(
	child: ChildProcess,
	timeoutSec: number,
	verbose = false,
): Promise<ClaudeResult> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		const stderrChunks: Buffer[] = [];

		child.stdout?.on("data", (chunk: Buffer) => {
			chunks.push(chunk);
			// In verbose mode with stream-json, log each event as it arrives
			if (verbose) logStreamEvent(chunk.toString("utf-8"));
		});
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

			logger.verbose(`Claude process finished (code=${code}, ${stdout.length} bytes)`);

			if (code !== 0 && !stdout.trim()) {
				const stderr = Buffer.concat(stderrChunks).toString("utf-8");
				reject(new Error(`Claude exited with code ${code}: ${stderr}`));
				return;
			}

			// stream-json: extract result from NDJSON lines; text: parse directly
			resolve(verbose ? parseStreamJsonOutput(stdout) : parseClaudeOutput(stdout));
		});
	});
}

/**
 * Log individual stream-json events for verbose debugging
 * Each line is a JSON object: tool_use, tool_result, assistant message, result, etc.
 */
function logStreamEvent(chunk: string): void {
	// Strip carriage returns for Windows CRLF compatibility
	for (const line of chunk.replace(/\r/g, "").split("\n").filter(Boolean)) {
		try {
			const event = JSON.parse(line) as Record<string, unknown>;
			const type = event.type as string;

			if (type === "assistant" && event.message) {
				const msg = event.message as Record<string, unknown>;
				const content = msg.content as Array<Record<string, unknown>> | undefined;
				if (content) {
					for (const block of content) {
						if (block.type === "tool_use") {
							logger.info(
								`  [claude] tool_use: ${block.name}(${JSON.stringify(block.input).slice(0, 200)})`,
							);
						} else if (block.type === "text") {
							const text = (block.text as string) ?? "";
							logger.info(
								`  [claude] text: ${text.slice(0, 300)}${text.length > 300 ? "..." : ""}`,
							);
						}
					}
				}
			} else if (type === "result") {
				const subtype = event.subtype ?? "unknown";
				const turns = event.num_turns ?? "?";
				const cost =
					typeof event.total_cost_usd === "number"
						? `$${(event.total_cost_usd as number).toFixed(4)}`
						: "?";
				logger.info(`  [claude] result: ${subtype} (${turns} turns, ${cost})`);
			}
		} catch {
			// Not valid JSON line — skip
		}
	}
}

/**
 * Parse stream-json (NDJSON) output — extract final result text from the last "result" event
 */
function parseStreamJsonOutput(stdout: string): ClaudeResult {
	// Strip carriage returns for Windows compatibility (CRLF → LF)
	const lines = stdout.replace(/\r/g, "").split("\n").filter(Boolean);

	// Find the last "result" event
	for (let i = lines.length - 1; i >= 0; i--) {
		try {
			const event = JSON.parse(lines[i]) as Record<string, unknown>;
			if (event.type === "result") {
				const resultText = typeof event.result === "string" ? event.result : "";
				if (!resultText && event.subtype === "error_max_turns") {
					return buildMetadataFallback(event);
				}
				return resultText ? parseClaudeOutput(resultText) : buildMetadataFallback(event);
			}
		} catch {
			/* skip non-JSON lines */
		}
	}

	// Fallback: try parsing entire output as text
	return parseClaudeOutput(stdout);
}

/**
 * Build the brainstorm analysis prompt for a GitHub issue
 * When skills are available, instructs Claude to use /brainstorm skill
 */
export function buildBrainstormPrompt(
	issue: GitHubIssue,
	repoName: string,
	skillsAvailable: boolean,
): string {
	const skillPrefix = skillsAvailable ? "/ck:brainstorm " : "";
	return `${skillPrefix}Analyze this GitHub issue for the project "${repoName}".

## Issue #${issue.number}: ${issue.title}

<untrusted-content>
${issue.body ?? ""}
</untrusted-content>

CRITICAL LANGUAGE RULE: Detect what language the issue title and body are written in, then respond ONLY in that same language. If the issue is in English, you MUST respond in English. If in Vietnamese, respond in Vietnamese. Do NOT use your system locale or any other language preference — ONLY match the issue author's language.

Respond with a JSON object:
{
  "response": "Your full analysis (markdown formatted, ending with Suggestions/Recommendations or Questions section)",
  "readyForPlan": false,
  "questionsForUser": ["Question 1?", "Question 2?"]
}

If you have enough information for a full implementation plan, set readyForPlan to true and questionsForUser to [].`;
}

/**
 * Parse Claude -p JSON output with multiple fallback strategies
 * Handles: pure JSON response, markdown-wrapped JSON, text + trailing CLI metadata
 */
export function parseClaudeOutput(stdout: string): ClaudeResult {
	const trimmed = stdout.trim();
	if (!trimmed) {
		return { response: "", readyForPlan: false, questionsForUser: [] };
	}

	// Handle Claude CLI error messages (e.g. "Error: Reached max turns (5)")
	if (/^Error:\s*Reached max turns/i.test(trimmed)) {
		return {
			response:
				"I wasn't able to complete the analysis within the allowed number of steps. " +
				"Could you provide more specific details or break this into smaller tasks?",
			readyForPlan: false,
			questionsForUser: ["Could you provide more specific details about what you need?"],
		};
	}

	// Strip trailing Claude CLI metadata JSON ({"type":"result",...}) if mixed with text
	const textContent = stripCliMetadata(trimmed);

	// Strategy 1: Direct JSON parse (Claude responds with our requested JSON format)
	try {
		const parsed = JSON.parse(textContent);
		if (parsed && typeof parsed === "object") {
			// Claude CLI metadata (type: "result") — not an actual response
			if (parsed.type === "result") {
				return buildMetadataFallback(parsed);
			}
			// Claude -p --output-format json wrapper: {result: "actual text"}
			if (typeof parsed.result === "string") {
				return unwrapResultEnvelope(parsed.result);
			}
		}
		return toClaudeResult(parsed);
	} catch {
		/* not top-level JSON */
	}

	// Strategy 2: JSON in markdown code block
	const cb = textContent.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
	if (cb)
		try {
			return toClaudeResult(JSON.parse(cb[1]));
		} catch {
			/* skip */
		}

	// Strategy 3: JSON object boundaries (look for our response format)
	const jm = textContent.match(/\{[\s\S]*"response"[\s\S]*\}/);
	if (jm)
		try {
			return toClaudeResult(JSON.parse(jm[0]));
		} catch {
			/* skip */
		}

	// Strategy 4: Plain text response (no JSON found)
	return { response: textContent, readyForPlan: false, questionsForUser: [] };
}

/**
 * Strip Claude CLI metadata JSON from end of output
 * CLI sometimes appends {"type":"result",...} after actual text response
 */
function stripCliMetadata(output: string): string {
	// Match trailing JSON object that looks like CLI metadata
	const metaPattern = /\n?\{"type"\s*:\s*"result"[\s\S]*\}\s*$/;
	const match = output.match(metaPattern);
	if (!match) return output;

	const textBefore = output.slice(0, match.index).trim();
	return textBefore || output; // If nothing before metadata, keep original for error handling
}

/**
 * Build a meaningful response when Claude CLI returns only metadata (e.g. error_max_turns)
 */
function buildMetadataFallback(meta: Record<string, unknown>): ClaudeResult {
	if (meta.subtype === "error_max_turns") {
		return {
			response:
				"I wasn't able to complete the analysis within the allowed number of steps. " +
				"The issue may need to be broken down into smaller parts, or more context may be needed.",
			readyForPlan: false,
			questionsForUser: [
				"Could you break this into smaller, more specific tasks?",
				"What specific aspect should I focus on first?",
			],
		};
	}
	if (meta.is_error === true) {
		return {
			response:
				"An error occurred while processing this issue. Please try again or provide more details.",
			readyForPlan: false,
			questionsForUser: [],
		};
	}
	return {
		response: "I encountered an issue while analyzing this. Could you provide more details?",
		readyForPlan: false,
		questionsForUser: [],
	};
}

/** Unwrap {result: "..."} envelope from claude -p --output-format json */
function unwrapResultEnvelope(resultStr: string): ClaudeResult {
	try {
		const inner = JSON.parse(resultStr);
		return toClaudeResult(inner);
	} catch {
		// result is plain text, not nested JSON
		return { response: resultStr, readyForPlan: false, questionsForUser: [] };
	}
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
