/**
 * Tests for diff-display module
 */
import { describe, expect, test } from "bun:test";
import { generateDiff } from "../diff-display.js";

describe("generateDiff", () => {
	test("generates unified diff for simple content change", () => {
		const oldContent = "Hello world\nThis is line 2\nThis is line 3";
		const newContent = "Hello world\nThis is modified line 2\nThis is line 3";

		const diff = generateDiff(oldContent, newContent, "test.md");

		expect(diff).toContain("a/test.md");
		expect(diff).toContain("b/test.md");
		expect(diff).toContain("-This is line 2");
		expect(diff).toContain("+This is modified line 2");
	});

	test("generates diff for identical content", () => {
		const content = "Same content\nNo changes";
		const diff = generateDiff(content, content, "unchanged.md");

		// Diff should be minimal or empty for identical content
		expect(diff).toBeDefined();
	});

	test("generates diff for added lines", () => {
		const oldContent = "Line 1\nLine 2";
		const newContent = "Line 1\nLine 2\nLine 3\nLine 4";

		const diff = generateDiff(oldContent, newContent, "added.md");

		expect(diff).toContain("+Line 3");
		expect(diff).toContain("+Line 4");
	});

	test("generates diff for removed lines", () => {
		const oldContent = "Line 1\nLine 2\nLine 3\nLine 4";
		const newContent = "Line 1\nLine 2";

		const diff = generateDiff(oldContent, newContent, "removed.md");

		expect(diff).toContain("-Line 3");
		expect(diff).toContain("-Line 4");
	});
});
