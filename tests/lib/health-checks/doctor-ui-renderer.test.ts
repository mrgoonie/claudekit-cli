import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { DoctorUIRenderer } from "../../../src/lib/health-checks/doctor-ui-renderer";
import type { CheckSummary, HealingSummary } from "../../../src/lib/health-checks/types";

describe("DoctorUIRenderer", () => {
	let renderer: DoctorUIRenderer;

	beforeEach(() => {
		renderer = new DoctorUIRenderer();
	});

	afterEach(() => {
		// Clean up any test modifications
	});

	describe("constructor and initialization", () => {
		it("should create a renderer instance", () => {
			expect(renderer).toBeDefined();
			expect(typeof renderer.renderResults).toBe("function");
			expect(typeof renderer.renderHealingSummary).toBe("function");
		});
	});

	describe("renderResults", () => {
		it("should handle empty check summary", () => {
			const summary: CheckSummary = {
				timestamp: "2025-12-03T00:00:00.000Z",
				total: 0,
				passed: 0,
				warnings: 0,
				failed: 0,
				fixed: 0,
				checks: [],
			};

			// Should not throw
			expect(() => renderer.renderResults(summary)).not.toThrow();
		});

		it("should handle check summary with different statuses", () => {
			const summary: CheckSummary = {
				timestamp: "2025-12-03T00:00:00.000Z",
				total: 3,
				passed: 1,
				warnings: 1,
				failed: 1,
				fixed: 0,
				checks: [
					{
						id: "node-version",
						name: "Node.js",
						group: "system",
						status: "pass",
						message: "v22.19.0",
						autoFixable: false,
					},
					{
						id: "claude-config",
						name: "Claude Config",
						group: "claudekit",
						status: "warn",
						message: "Outdated",
						suggestion: "Update .claude/config.json",
						autoFixable: true,
					},
					{
						id: "gh-auth",
						name: "GitHub Auth",
						group: "auth",
						status: "fail",
						message: "Not authenticated",
						suggestion: "Run gh auth login",
						autoFixable: false,
					},
				],
			};

			// Should not throw
			expect(() => renderer.renderResults(summary)).not.toThrow();
		});

		it("should handle checks with details", () => {
			const summary: CheckSummary = {
				timestamp: "2025-12-03T00:00:00.000Z",
				total: 1,
				passed: 0,
				warnings: 1,
				failed: 0,
				fixed: 0,
				checks: [
					{
						id: "claude-config",
						name: "Claude Config",
						group: "claudekit",
						status: "warn",
						message: "Outdated",
						details: "Found version 1.0, expected 2.0",
						suggestion: "Update .claude/config.json",
						autoFixable: true,
					},
				],
			};

			// Should not throw
			expect(() => renderer.renderResults(summary)).not.toThrow();
		});
	});

	describe("renderHealingSummary", () => {
		it("should handle empty healing summary", () => {
			const healSummary: HealingSummary = {
				totalFixable: 0,
				attempted: 0,
				succeeded: 0,
				failed: 0,
				fixes: [],
			};

			// Should not throw
			expect(() => renderer.renderHealingSummary(healSummary)).not.toThrow();
		});

		it("should handle successful fixes", () => {
			const healSummary: HealingSummary = {
				totalFixable: 1,
				attempted: 1,
				succeeded: 1,
				failed: 0,
				fixes: [
					{
						checkId: "package-json",
						checkName: "Package JSON",
						fixId: "init-package",
						success: true,
						message: "Created package.json",
						duration: 100,
					},
				],
			};

			// Should not throw
			expect(() => renderer.renderHealingSummary(healSummary)).not.toThrow();
		});

		it("should handle failed fixes with errors", () => {
			const healSummary: HealingSummary = {
				totalFixable: 1,
				attempted: 1,
				succeeded: 0,
				failed: 1,
				fixes: [
					{
						checkId: "git-repo",
						checkName: "Git Repository",
						fixId: "init-git",
						success: false,
						message: "Failed to initialize git",
						error: "Permission denied",
						duration: 50,
					},
				],
			};

			// Should not throw
			expect(() => renderer.renderHealingSummary(healSummary)).not.toThrow();
		});

		it("should handle mixed success and failure", () => {
			const healSummary: HealingSummary = {
				totalFixable: 2,
				attempted: 2,
				succeeded: 1,
				failed: 1,
				fixes: [
					{
						checkId: "package-json",
						checkName: "Package JSON",
						fixId: "init-package",
						success: true,
						message: "Created package.json",
						duration: 100,
					},
					{
						checkId: "git-repo",
						checkName: "Git Repository",
						fixId: "init-git",
						success: false,
						message: "Failed to initialize git",
						error: "Permission denied",
						duration: 50,
					},
				],
			};

			// Should not throw
			expect(() => renderer.renderHealingSummary(healSummary)).not.toThrow();
		});
	});
});
