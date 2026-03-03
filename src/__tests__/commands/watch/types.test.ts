import { describe, expect, test } from "bun:test";
import {
	GitHubIssueSchema,
	IssueStateSchema,
	IssueStatusEnum,
	WatchConfigSchema,
	WatchStateSchema,
} from "../../../commands/watch/types.js";

describe("WatchConfigSchema", () => {
	test("parses empty config with defaults", () => {
		const result = WatchConfigSchema.parse({});
		expect(result.pollIntervalMs).toBe(30000);
		expect(result.maxTurnsPerIssue).toBe(10);
		expect(result.maxIssuesPerHour).toBe(10);
		expect(result.excludeAuthors).toEqual([]);
		expect(result.showBranding).toBe(true);
		expect(result.timeouts.brainstormSec).toBe(300);
		expect(result.timeouts.planSec).toBe(600);
	});

	test("rejects pollIntervalMs below 10000", () => {
		expect(() => WatchConfigSchema.parse({ pollIntervalMs: 1000 })).toThrow();
	});

	test("parses full config", () => {
		const result = WatchConfigSchema.parse({
			pollIntervalMs: 60000,
			maxTurnsPerIssue: 5,
			excludeAuthors: ["bot1"],
			state: {
				lastCheckedAt: "2026-01-01T00:00:00Z",
				activeIssues: {},
				processedIssues: [1, 2],
			},
		});
		expect(result.state.processedIssues).toEqual([1, 2]);
		expect(result.excludeAuthors).toEqual(["bot1"]);
	});
});

describe("IssueStatusEnum", () => {
	test("accepts valid statuses", () => {
		const statuses = [
			"new",
			"brainstorming",
			"clarifying",
			"planning",
			"completed",
			"error",
			"timeout",
		] as const;
		for (const status of statuses) {
			expect(IssueStatusEnum.parse(status)).toBe(status);
		}
	});

	test("rejects invalid status", () => {
		expect(() => IssueStatusEnum.parse("invalid")).toThrow();
	});
});

describe("IssueStateSchema", () => {
	test("parses valid issue state", () => {
		const result = IssueStateSchema.parse({
			status: "brainstorming",
			turnsUsed: 2,
			createdAt: "2026-03-03T10:00:00Z",
			title: "Add dark mode",
		});
		expect(result.conversationHistory).toEqual([]);
	});
});

describe("WatchStateSchema", () => {
	test("parses empty state with defaults", () => {
		const result = WatchStateSchema.parse({});
		expect(result.activeIssues).toEqual({});
		expect(result.processedIssues).toEqual([]);
	});
});

describe("GitHubIssueSchema", () => {
	test("parses valid issue", () => {
		const result = GitHubIssueSchema.parse({
			number: 42,
			title: "Add feature",
			body: "Description here",
			author: { login: "user1" },
			createdAt: "2026-03-03T10:00:00Z",
			state: "open",
		});
		expect(result.number).toBe(42);
		expect(result.labels).toEqual([]);
	});

	test("handles null body", () => {
		const result = GitHubIssueSchema.parse({
			number: 1,
			title: "No body",
			body: null,
			author: { login: "user1" },
			createdAt: "2026-03-03T10:00:00Z",
			state: "open",
		});
		expect(result.body).toBeNull();
	});
});
