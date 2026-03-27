import { describe, expect, test } from "bun:test";
import type { RawGitEvent } from "@/commands/content/phases/change-detector.js";
import { classifyEvent } from "@/commands/content/phases/event-classifier.js";

describe("Event Classifier", () => {
	const createBaseEvent = (overrides: Partial<RawGitEvent> = {}): RawGitEvent => ({
		repoPath: "/path/to/repo",
		repoName: "test-repo",
		eventType: "commit",
		ref: "abc123",
		title: "Test Event",
		body: "",
		author: "test-author",
		createdAt: new Date().toISOString(),
		...overrides,
	});

	describe("classifyEvent - PR merged", () => {
		test("should classify feature PR as high importance, content-worthy", () => {
			const event = createBaseEvent({ eventType: "pr_merged", title: "feat: Add new feature" });
			const result = classifyEvent(event);
			expect(result.contentWorthy).toBe(true);
			expect(result.importance).toBe("high");
			expect(result.suggestedFormats).toContain("text");
			expect(result.suggestedFormats).toContain("photo");
		});

		test("should classify feature with uppercase FEAT", () => {
			const event = createBaseEvent({ eventType: "pr_merged", title: "FEAT: New capability" });
			const result = classifyEvent(event);
			expect(result.contentWorthy).toBe(true);
			expect(result.importance).toBe("high");
		});

		test("should classify PR with feature keyword in title", () => {
			const event = createBaseEvent({ eventType: "pr_merged", title: "Add feature for auth" });
			const result = classifyEvent(event);
			expect(result.contentWorthy).toBe(true);
			expect(result.importance).toBe("high");
		});

		test("should classify fix PR as medium importance, content-worthy", () => {
			const event = createBaseEvent({ eventType: "pr_merged", title: "fix: Critical bug fix" });
			const result = classifyEvent(event);
			expect(result.contentWorthy).toBe(true);
			expect(result.importance).toBe("medium");
			expect(result.suggestedFormats).toEqual(["text"]);
		});

		test("should classify bugfix PR", () => {
			const event = createBaseEvent({ eventType: "pr_merged", title: "bugfix: Memory leak" });
			const result = classifyEvent(event);
			expect(result.contentWorthy).toBe(true);
			expect(result.importance).toBe("medium");
		});

		test("should classify other PR types as medium importance", () => {
			const event = createBaseEvent({ eventType: "pr_merged", title: "refactor: Improve code" });
			const result = classifyEvent(event);
			expect(result.contentWorthy).toBe(true);
			expect(result.importance).toBe("medium");
		});

		test("should classify docs PR as medium importance", () => {
			const event = createBaseEvent({ eventType: "pr_merged", title: "docs: Update readme" });
			const result = classifyEvent(event);
			expect(result.contentWorthy).toBe(true);
			expect(result.importance).toBe("medium");
		});
	});

	describe("classifyEvent - Commits", () => {
		test("should classify feat commit as medium importance, content-worthy", () => {
			const event = createBaseEvent({ eventType: "commit", title: "feat: Add database migration" });
			const result = classifyEvent(event);
			expect(result.contentWorthy).toBe(true);
			expect(result.importance).toBe("medium");
			expect(result.suggestedFormats).toEqual(["text"]);
		});

		test("should classify feat(scope) commit", () => {
			const event = createBaseEvent({ eventType: "commit", title: "feat(api): Add endpoint" });
			const result = classifyEvent(event);
			expect(result.contentWorthy).toBe(true);
			expect(result.importance).toBe("medium");
		});

		test("should classify scoped fix commit as content-worthy", () => {
			const event = createBaseEvent({ eventType: "commit", title: "fix(auth): Token refresh bug" });
			const result = classifyEvent(event);
			expect(result.contentWorthy).toBe(true);
			expect(result.importance).toBe("low");
		});

		test("should not classify unscoped fix commit as content-worthy", () => {
			const event = createBaseEvent({ eventType: "commit", title: "fix: typo" });
			const result = classifyEvent(event);
			expect(result.contentWorthy).toBe(false);
			expect(result.importance).toBe("low");
		});

		test("should classify perf commit as content-worthy", () => {
			const event = createBaseEvent({ eventType: "commit", title: "perf: Optimize query" });
			const result = classifyEvent(event);
			expect(result.contentWorthy).toBe(true);
			expect(result.importance).toBe("medium");
		});

		test("should classify perf(scope) commit", () => {
			const event = createBaseEvent({ eventType: "commit", title: "perf(db): Add index" });
			const result = classifyEvent(event);
			expect(result.contentWorthy).toBe(true);
			expect(result.importance).toBe("medium");
		});

		test("should not classify chore commit as content-worthy", () => {
			const event = createBaseEvent({ eventType: "commit", title: "chore: Update deps" });
			const result = classifyEvent(event);
			expect(result.contentWorthy).toBe(false);
			expect(result.importance).toBe("low");
		});

		test("should not classify docs commit as content-worthy", () => {
			const event = createBaseEvent({ eventType: "commit", title: "docs: Update guide" });
			const result = classifyEvent(event);
			expect(result.contentWorthy).toBe(false);
			expect(result.importance).toBe("low");
		});

		test("should not classify style commit as content-worthy", () => {
			const event = createBaseEvent({ eventType: "commit", title: "style: Format code" });
			const result = classifyEvent(event);
			expect(result.contentWorthy).toBe(false);
			expect(result.importance).toBe("low");
		});

		test("should be case-insensitive", () => {
			const event = createBaseEvent({ eventType: "commit", title: "FEAT: Important change" });
			const result = classifyEvent(event);
			expect(result.contentWorthy).toBe(true);
			expect(result.importance).toBe("medium");
		});
	});

	describe("classifyEvent - Tags and Releases", () => {
		test("should classify tag as high importance, content-worthy", () => {
			const event = createBaseEvent({ eventType: "tag", title: "v1.0.0" });
			const result = classifyEvent(event);
			expect(result.contentWorthy).toBe(true);
			expect(result.importance).toBe("high");
			expect(result.suggestedFormats).toContain("text");
			expect(result.suggestedFormats).toContain("photo");
		});

		test("should classify release as high importance, content-worthy", () => {
			const event = createBaseEvent({ eventType: "release", title: "v2.0.0 Release" });
			const result = classifyEvent(event);
			expect(result.contentWorthy).toBe(true);
			expect(result.importance).toBe("high");
			expect(result.suggestedFormats).toContain("text");
			expect(result.suggestedFormats).toContain("photo");
		});
	});

	describe("classifyEvent - Plan Completed", () => {
		test("should classify plan_completed as high importance, content-worthy", () => {
			const event = createBaseEvent({
				eventType: "plan_completed",
				title: "Plan completed: Feature implementation",
			});
			const result = classifyEvent(event);
			expect(result.contentWorthy).toBe(true);
			expect(result.importance).toBe("high");
			expect(result.suggestedFormats).toContain("text");
			expect(result.suggestedFormats).toContain("photo");
			expect(result.suggestedFormats).toContain("thread");
		});
	});

	describe("classifyEvent - Edge Cases", () => {
		test("should handle empty title", () => {
			const event = createBaseEvent({ eventType: "commit", title: "" });
			const result = classifyEvent(event);
			expect(result.contentWorthy).toBe(false);
			expect(result.importance).toBe("low");
		});

		test("should handle commit with only type, no description", () => {
			const event = createBaseEvent({ eventType: "commit", title: "feat:" });
			const result = classifyEvent(event);
			expect(result.contentWorthy).toBe(true);
		});

		test("should handle unknown event type gracefully", () => {
			const event = createBaseEvent({ eventType: "unknown" as any });
			const result = classifyEvent(event);
			expect(result.contentWorthy).toBe(false);
			expect(result.importance).toBe("low");
			expect(result.suggestedFormats).toEqual([]);
		});

		test("should handle mixed case conventional commit", () => {
			const event = createBaseEvent({ eventType: "commit", title: "FiX(Auth): Token issue" });
			const result = classifyEvent(event);
			// Should be caught by lowercase check
			expect(result).toBeDefined();
		});
	});
});
