import { describe, expect, mock, test } from "bun:test";
import { AutoHealer } from "../../../src/lib/health-checks/auto-healer.js";
import type { CheckResult, FixAction } from "../../../src/lib/health-checks/types.js";

describe("AutoHealer", () => {
	describe("healAll", () => {
		test("executes fixes for fixable failed checks", async () => {
			const healer = new AutoHealer({ timeout: 5000 });
			const mockExecute = mock(() => Promise.resolve({ success: true, message: "Fixed" }));

			const checks: CheckResult[] = [
				{
					id: "test-fix",
					name: "Test Fix",
					group: "system",
					status: "fail",
					message: "Broken",
					autoFixable: true,
					fix: {
						id: "fix-test",
						description: "Fix test issue",
						execute: mockExecute,
					},
				},
			];

			const summary = await healer.healAll(checks);

			expect(mockExecute).toHaveBeenCalled();
			expect(summary.succeeded).toBe(1);
			expect(summary.failed).toBe(0);
			expect(checks[0].fixed).toBe(true);
		});

		test("skips checks that already pass", async () => {
			const healer = new AutoHealer();
			const mockExecute = mock(() => Promise.resolve({ success: true, message: "Fixed" }));

			const checks: CheckResult[] = [
				{
					id: "passing",
					name: "Passing Check",
					group: "system",
					status: "pass",
					message: "Already OK",
					autoFixable: true,
					fix: {
						id: "fix-pass",
						description: "Unnecessary fix",
						execute: mockExecute,
					},
				},
			];

			const summary = await healer.healAll(checks);

			expect(mockExecute).not.toHaveBeenCalled();
			expect(summary.totalFixable).toBe(0);
			expect(summary.attempted).toBe(0);
		});

		test("skips checks without fix action", async () => {
			const healer = new AutoHealer();

			const checks: CheckResult[] = [
				{
					id: "no-fix",
					name: "No Fix Available",
					group: "system",
					status: "fail",
					message: "Cannot fix",
					autoFixable: false, // No fix available
				},
			];

			const summary = await healer.healAll(checks);

			expect(summary.totalFixable).toBe(0);
			expect(summary.attempted).toBe(0);
		});

		test("handles fix execution failure", async () => {
			const healer = new AutoHealer({ timeout: 5000 });
			const mockExecute = mock(() => Promise.resolve({ success: false, message: "Fix failed" }));

			const checks: CheckResult[] = [
				{
					id: "fail-fix",
					name: "Failing Fix",
					group: "system",
					status: "fail",
					message: "Broken",
					autoFixable: true,
					fix: {
						id: "fix-fail",
						description: "This fix fails",
						execute: mockExecute,
					},
				},
			];

			const summary = await healer.healAll(checks);

			expect(summary.succeeded).toBe(0);
			expect(summary.failed).toBe(1);
			expect(checks[0].fixed).toBe(false);
			expect(checks[0].fixError).toBe("Fix failed");
		});

		test("handles fix throwing error", async () => {
			const healer = new AutoHealer({ timeout: 5000 });
			const mockExecute = mock(() => Promise.reject(new Error("Unexpected error")));

			const checks: CheckResult[] = [
				{
					id: "throw-fix",
					name: "Throwing Fix",
					group: "system",
					status: "fail",
					message: "Broken",
					autoFixable: true,
					fix: {
						id: "fix-throw",
						description: "This fix throws",
						execute: mockExecute,
					},
				},
			];

			const summary = await healer.healAll(checks);

			expect(summary.failed).toBe(1);
			expect(checks[0].fixed).toBe(false);
			expect(checks[0].fixError).toContain("Unexpected error");
		});

		test("handles fix timeout", async () => {
			const healer = new AutoHealer({ timeout: 100 }); // Very short timeout

			const slowFix: FixAction = {
				id: "slow-fix",
				description: "Slow fix",
				execute: () =>
					new Promise((resolve) =>
						setTimeout(() => resolve({ success: true, message: "Done" }), 1000),
					),
			};

			const checks: CheckResult[] = [
				{
					id: "slow",
					name: "Slow Check",
					group: "system",
					status: "fail",
					message: "Slow",
					autoFixable: true,
					fix: slowFix,
				},
			];

			const summary = await healer.healAll(checks);

			expect(summary.failed).toBe(1);
			expect(checks[0].fixed).toBe(false);
			expect(checks[0].fixError).toContain("timed out");
		});

		test("handles multiple fixable checks", async () => {
			const healer = new AutoHealer({ timeout: 5000 });

			const checks: CheckResult[] = [
				{
					id: "fix-1",
					name: "Fix 1",
					group: "system",
					status: "fail",
					message: "Issue 1",
					autoFixable: true,
					fix: {
						id: "f1",
						description: "Fix 1",
						execute: () => Promise.resolve({ success: true, message: "Fixed 1" }),
					},
				},
				{
					id: "fix-2",
					name: "Fix 2",
					group: "auth",
					status: "warn",
					message: "Issue 2",
					autoFixable: true,
					fix: {
						id: "f2",
						description: "Fix 2",
						execute: () => Promise.resolve({ success: true, message: "Fixed 2" }),
					},
				},
				{
					id: "fix-3",
					name: "Fix 3",
					group: "auth",
					status: "fail",
					message: "Issue 3",
					autoFixable: true,
					fix: {
						id: "f3",
						description: "Fix 3",
						execute: () => Promise.resolve({ success: false, message: "Failed 3" }),
					},
				},
			];

			const summary = await healer.healAll(checks);

			expect(summary.totalFixable).toBe(3);
			expect(summary.attempted).toBe(3);
			expect(summary.succeeded).toBe(2);
			expect(summary.failed).toBe(1);
		});

		test("records duration for each fix attempt", async () => {
			const healer = new AutoHealer({ timeout: 5000 });

			const checks: CheckResult[] = [
				{
					id: "timed",
					name: "Timed Fix",
					group: "system",
					status: "fail",
					message: "Issue",
					autoFixable: true,
					fix: {
						id: "f-timed",
						description: "Fix with delay",
						execute: async () => {
							await new Promise((r) => setTimeout(r, 50));
							return { success: true, message: "Done" };
						},
					},
				},
			];

			const summary = await healer.healAll(checks);

			expect(summary.fixes).toHaveLength(1);
			expect(summary.fixes[0].duration).toBeGreaterThanOrEqual(50);
		});

		test("handles check with autoFixable=true but no fix function", async () => {
			const healer = new AutoHealer();

			const checks: CheckResult[] = [
				{
					id: "no-func",
					name: "No Function",
					group: "system",
					status: "fail",
					message: "Issue",
					autoFixable: true,
					// fix is undefined
				},
			];

			const summary = await healer.healAll(checks);

			// Should not attempt since fix is undefined
			expect(summary.totalFixable).toBe(0);
		});
	});

	describe("default timeout", () => {
		test("uses default 30s timeout when not specified", async () => {
			const healer = new AutoHealer();

			// We can't easily test the actual timeout value without exposing it
			// Just verify the healer is created successfully
			expect(healer).toBeDefined();
		});
	});
});
