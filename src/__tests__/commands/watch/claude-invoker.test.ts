import { describe, expect, test } from "bun:test";
import {
	buildBrainstormPrompt,
	parseClaudeOutput,
} from "../../../commands/watch/phases/claude-invoker.js";
import type { GitHubIssue } from "../../../commands/watch/types.js";

const mockIssue: GitHubIssue = {
	number: 42,
	title: "Add dark mode",
	body: "I'd like the app to support dark mode for better readability at night.",
	author: { login: "user1" },
	createdAt: "2026-03-03T10:00:00Z",
	updatedAt: "2026-03-03T10:00:00Z",
	labels: [{ name: "enhancement" }],
	state: "open",
};

describe("buildBrainstormPrompt", () => {
	test("includes issue number and title", () => {
		const prompt = buildBrainstormPrompt(mockIssue, "owner/repo", true);
		expect(prompt).toContain("#42");
		expect(prompt).toContain("Add dark mode");
	});

	test("wraps body in untrusted-content tags", () => {
		const prompt = buildBrainstormPrompt(mockIssue, "owner/repo", true);
		expect(prompt).toContain("<untrusted-content>");
		expect(prompt).toContain("</untrusted-content>");
	});

	test("includes repo name", () => {
		const prompt = buildBrainstormPrompt(mockIssue, "owner/repo", true);
		expect(prompt).toContain("owner/repo");
	});

	test("requests JSON response format", () => {
		const prompt = buildBrainstormPrompt(mockIssue, "owner/repo", true);
		expect(prompt).toContain("readyForPlan");
		expect(prompt).toContain("questionsForUser");
	});

	test("handles null body", () => {
		const issueNoBody = { ...mockIssue, body: null };
		const prompt = buildBrainstormPrompt(issueNoBody, "owner/repo", true);
		expect(prompt).toContain("#42");
	});
});

describe("parseClaudeOutput", () => {
	test("parses clean JSON", () => {
		const json = '{"response":"Hello","readyForPlan":false,"questionsForUser":[]}';
		const result = parseClaudeOutput(json);
		expect(result.response).toBe("Hello");
		expect(result.readyForPlan).toBe(false);
		expect(result.questionsForUser).toEqual([]);
	});

	test("parses JSON in markdown code block", () => {
		const output =
			'```json\n{"response":"Plan ready","readyForPlan":true,"questionsForUser":[]}\n```';
		const result = parseClaudeOutput(output);
		expect(result.readyForPlan).toBe(true);
		expect(result.response).toBe("Plan ready");
	});

	test("falls back to raw text when JSON invalid", () => {
		const result = parseClaudeOutput("Just a plain text response");
		expect(result.response).toBe("Just a plain text response");
		expect(result.readyForPlan).toBe(false);
		expect(result.questionsForUser).toEqual([]);
	});

	test("handles empty output", () => {
		const result = parseClaudeOutput("");
		expect(result.response).toBe("");
		expect(result.readyForPlan).toBe(false);
	});

	test("extracts JSON from mixed text", () => {
		const output =
			'Some text before {"response":"Found it","readyForPlan":true,"questionsForUser":["Q1"]} and after';
		const result = parseClaudeOutput(output);
		expect(result.response).toBe("Found it");
		expect(result.readyForPlan).toBe(true);
		expect(result.questionsForUser).toEqual(["Q1"]);
	});

	test("parses claude -p --output-format json wrapper", () => {
		const output = JSON.stringify({
			result: '{"response":"Wrapped","readyForPlan":false,"questionsForUser":[]}',
		});
		const result = parseClaudeOutput(output);
		expect(result.response).toBe("Wrapped");
	});

	test("handles CLI metadata (error_max_turns) without leaking JSON", () => {
		const output = JSON.stringify({
			type: "result",
			subtype: "error_max_turns",
			duration_ms: 37919,
			is_error: false,
			num_turns: 6,
			session_id: "abc-123",
			total_cost_usd: 0.35,
		});
		const result = parseClaudeOutput(output);
		expect(result.response).not.toContain('"type"');
		expect(result.response).not.toContain("error_max_turns");
		expect(result.readyForPlan).toBe(false);
	});

	test("strips trailing CLI metadata from text + JSON output", () => {
		const text = "Here is my analysis of the issue.";
		const meta = JSON.stringify({ type: "result", subtype: "success", is_error: false });
		const result = parseClaudeOutput(`${text}\n${meta}`);
		expect(result.response).toBe(text);
		expect(result.response).not.toContain('"type"');
	});

	test("handles readyForPlan as non-boolean gracefully", () => {
		const json = '{"response":"Test","readyForPlan":"maybe","questionsForUser":[]}';
		const result = parseClaudeOutput(json);
		expect(result.readyForPlan).toBe(false);
	});
});
