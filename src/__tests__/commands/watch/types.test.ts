import { describe, expect, test } from "bun:test";
import {
	GitHubIssueSchema,
	IssueStateSchema,
	IssueStatusEnum,
	WatchConfigSchema,
	WatchStateSchema,
	WatchTimeoutsSchema,
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
		expect(result.timeouts.implementSec).toBe(18000);
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

describe("WatchTimeoutsSchema", () => {
	test("parses empty timeouts with defaults", () => {
		const result = WatchTimeoutsSchema.parse({});
		expect(result.brainstormSec).toBe(300);
		expect(result.planSec).toBe(600);
		expect(result.implementSec).toBe(18000);
	});

	test("implementSec default is 18000 (5 hours)", () => {
		const result = WatchTimeoutsSchema.parse({});
		expect(result.implementSec).toBe(18000);
		expect(result.implementSec / 60 / 60).toBe(5);
	});

	test("parses custom timeout values", () => {
		const result = WatchTimeoutsSchema.parse({
			brainstormSec: 100,
			planSec: 200,
			implementSec: 30000,
		});
		expect(result.brainstormSec).toBe(100);
		expect(result.planSec).toBe(200);
		expect(result.implementSec).toBe(30000);
	});
});

describe("IssueStatusEnum", () => {
	test("accepts valid statuses", () => {
		const statuses = [
			"new",
			"brainstorming",
			"clarifying",
			"planning",
			"plan_posted",
			"awaiting_approval",
			"implementing",
			"completed",
			"error",
			"timeout",
		] as const;
		for (const status of statuses) {
			expect(IssueStatusEnum.parse(status)).toBe(status);
		}
	});

	test("accepts awaiting_approval status", () => {
		expect(IssueStatusEnum.parse("awaiting_approval")).toBe("awaiting_approval");
	});

	test("accepts implementing status", () => {
		expect(IssueStatusEnum.parse("implementing")).toBe("implementing");
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

	test("parses optional planPath field", () => {
		const result = IssueStateSchema.parse({
			status: "plan_posted",
			createdAt: "2026-03-03T10:00:00Z",
			title: "Test issue",
			planPath: "plans/260303-1815-test/plan.md",
		});
		expect(result.planPath).toBe("plans/260303-1815-test/plan.md");
	});

	test("parses optional branchName field", () => {
		const result = IssueStateSchema.parse({
			status: "implementing",
			createdAt: "2026-03-03T10:00:00Z",
			title: "Test issue",
			branchName: "ck-watch/issue-42",
		});
		expect(result.branchName).toBe("ck-watch/issue-42");
	});

	test("parses optional prUrl field", () => {
		const result = IssueStateSchema.parse({
			status: "implementing",
			createdAt: "2026-03-03T10:00:00Z",
			title: "Test issue",
			prUrl: "https://github.com/owner/repo/pull/123",
		});
		expect(result.prUrl).toBe("https://github.com/owner/repo/pull/123");
	});

	test("parses issue state with all optional fields", () => {
		const result = IssueStateSchema.parse({
			status: "implementing",
			turnsUsed: 5,
			createdAt: "2026-03-03T10:00:00Z",
			title: "Complex issue",
			planPath: "plans/test/plan.md",
			branchName: "ck-watch/issue-100",
			prUrl: "https://github.com/owner/repo/pull/200",
		});
		expect(result.planPath).toBe("plans/test/plan.md");
		expect(result.branchName).toBe("ck-watch/issue-100");
		expect(result.prUrl).toBe("https://github.com/owner/repo/pull/200");
	});
});

describe("WatchStateSchema", () => {
	test("parses empty state with defaults", () => {
		const result = WatchStateSchema.parse({});
		expect(result.activeIssues).toEqual({});
		expect(result.processedIssues).toEqual([]);
	});

	test("parses implementationQueue with default empty array", () => {
		const result = WatchStateSchema.parse({});
		expect(result.implementationQueue).toEqual([]);
	});

	test("parses implementationQueue with issues", () => {
		const result = WatchStateSchema.parse({
			implementationQueue: [1, 2, 3],
		});
		expect(result.implementationQueue).toEqual([1, 2, 3]);
	});

	test("parses currentlyImplementing with null default", () => {
		const result = WatchStateSchema.parse({});
		expect(result.currentlyImplementing).toBeNull();
	});

	test("parses currentlyImplementing with issue number", () => {
		const result = WatchStateSchema.parse({
			currentlyImplementing: 42,
		});
		expect(result.currentlyImplementing).toBe(42);
	});

	test("parses full state with implementation fields", () => {
		const result = WatchStateSchema.parse({
			activeIssues: {
				"1": {
					status: "implementing",
					createdAt: "2026-03-03T10:00:00Z",
					title: "Issue 1",
					branchName: "ck-watch/issue-1",
				},
			},
			implementationQueue: [2, 3],
			currentlyImplementing: 1,
		});
		expect(result.currentlyImplementing).toBe(1);
		expect(result.implementationQueue).toEqual([2, 3]);
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
			updatedAt: "2026-03-03T10:00:00Z",
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
			updatedAt: "2026-03-03T10:00:00Z",
			state: "open",
		});
		expect(result.body).toBeNull();
	});
});
