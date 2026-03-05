import { describe, expect, test } from "bun:test";
import type { ImplementationResult } from "../../../commands/watch/phases/implementation-runner.js";

describe("implementation-runner", () => {
	describe("ImplementationResult type", () => {
		test("result object has required properties", () => {
			const result: ImplementationResult = {
				success: true,
				branchName: "ck-watch/issue-123",
				prUrl: "https://github.com/owner/repo/pull/456",
				error: null,
			};

			expect(result.success).toBe(true);
			expect(result.branchName).toContain("ck-watch/issue-");
			expect(result.prUrl).toContain("https://");
			expect(result.error).toBeNull();
		});

		test("result can have null prUrl on failure", () => {
			const result: ImplementationResult = {
				success: false,
				branchName: "ck-watch/issue-789",
				prUrl: null,
				error: "Branch creation failed",
			};

			expect(result.success).toBe(false);
			expect(result.prUrl).toBeNull();
			expect(result.error).toBeTruthy();
		});

		test("branch name follows convention ck-watch/issue-N", () => {
			const result: ImplementationResult = {
				success: true,
				branchName: "ck-watch/issue-42",
				prUrl: null,
				error: null,
			};

			const match = result.branchName.match(/^ck-watch\/issue-\d+/);
			expect(match).toBeTruthy();
		});

		test("branch name can include timestamp suffix for duplicates", () => {
			const result: ImplementationResult = {
				success: true,
				branchName: "ck-watch/issue-123-1709500800",
				prUrl: null,
				error: null,
			};

			const match = result.branchName.match(/^ck-watch\/issue-\d+(-\d+)?$/);
			expect(match).toBeTruthy();
		});
	});
});
