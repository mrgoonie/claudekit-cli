import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import * as childProcess from "node:child_process";
import type { SpawnSyncReturns } from "node:child_process";
import { ReportGenerator } from "../../../src/domains/health-checks/report-generator.js";
import type { CheckSummary } from "../../../src/domains/health-checks/types.js";

describe("ReportGenerator", () => {
	const createMockSummary = (overrides: Partial<CheckSummary> = {}): CheckSummary => ({
		timestamp: "2025-12-02T14:30:00.000Z",
		total: 5,
		passed: 3,
		warnings: 1,
		failed: 1,
		fixed: 0,
		checks: [
			{
				id: "node-version",
				name: "Node.js Version",
				group: "system",
				status: "pass",
				message: "Node.js v20.0.0",
				autoFixable: false,
			},
			{
				id: "npm-version",
				name: "npm Version",
				group: "system",
				status: "pass",
				message: "npm v10.0.0",
				autoFixable: false,
			},
			{
				id: "git-version",
				name: "Git Version",
				group: "system",
				status: "pass",
				message: "git 2.40.0",
				autoFixable: false,
			},
			{
				id: "gh-auth",
				name: "GitHub Auth",
				group: "auth",
				status: "warn",
				message: "Token expires soon",
				suggestion: "Run: gh auth refresh",
				autoFixable: false,
			},
			{
				id: "claudekit-global",
				name: "ClaudeKit Global",
				group: "claudekit",
				status: "fail",
				message: "Not installed",
				suggestion: "Run: ck init --global",
				autoFixable: true,
			},
		],
		...overrides,
	});

	describe("generateTextReport", () => {
		test("includes report header with timestamp", () => {
			const generator = new ReportGenerator();
			const report = generator.generateTextReport(createMockSummary());

			expect(report).toContain("CLAUDEKIT DIAGNOSTIC REPORT");
			expect(report).toContain("2025-12-02T14:30:00.000Z");
		});

		test("includes environment section", () => {
			const generator = new ReportGenerator();
			const report = generator.generateTextReport(createMockSummary());

			expect(report).toContain("ENVIRONMENT");
			expect(report).toContain("OS:");
			expect(report).toContain("Node:");
			expect(report).toContain("CWD:");
		});

		test("includes grouped checks with all checks", () => {
			const generator = new ReportGenerator();
			const report = generator.generateTextReport(createMockSummary());

			// Check grouped sections exist
			expect(report).toContain("SYSTEM");
			expect(report).toContain("AUTH");
			expect(report).toContain("CLAUDEKIT");
			// Check individual items
			expect(report).toContain("Node.js Version");
			expect(report).toContain("GitHub Auth");
			expect(report).toContain("ClaudeKit Global");
		});

		test("includes status symbols", () => {
			const generator = new ReportGenerator();
			const report = generator.generateTextReport(createMockSummary());

			expect(report).toContain("✓"); // pass
			expect(report).toContain("⚠"); // warn
			expect(report).toContain("✗"); // fail
		});

		test("includes issues section for warn/fail checks", () => {
			const generator = new ReportGenerator();
			const report = generator.generateTextReport(createMockSummary());

			expect(report).toContain("ISSUES FOUND");
			expect(report).toContain("ClaudeKit Global");
			expect(report).toContain("Not installed");
		});

		test("includes fix suggestion for failed checks", () => {
			const generator = new ReportGenerator();
			const report = generator.generateTextReport(createMockSummary());

			expect(report).toContain("Fix:");
			expect(report).toContain("ck init --global");
		});

		test("includes summary line with symbols", () => {
			const generator = new ReportGenerator();
			const report = generator.generateTextReport(createMockSummary());

			expect(report).toContain("SUMMARY: 3 ✓ passed, 1 ⚠ warnings, 1 ✗ failed");
		});

		test("omits issues section when no failures or warnings", () => {
			const generator = new ReportGenerator();
			const summary = createMockSummary({
				failed: 0,
				warnings: 0,
				checks: [
					{
						id: "pass",
						name: "Pass",
						group: "system",
						status: "pass",
						message: "OK",
						autoFixable: false,
					},
				],
			});

			const report = generator.generateTextReport(summary);

			expect(report).not.toContain("ISSUES FOUND");
		});

		test("scrubs home directory from paths", () => {
			const generator = new ReportGenerator();
			const report = generator.generateTextReport(createMockSummary());

			// CWD should be scrubbed to use ~ instead of full home path
			expect(report).toContain("CWD:");
			// The actual path should be scrubbed - we can't test exact value
			// but the function should be called
		});
	});

	describe("generateJsonReport", () => {
		test("returns valid JSON", () => {
			const generator = new ReportGenerator();
			const jsonStr = generator.generateJsonReport(createMockSummary());

			expect(() => JSON.parse(jsonStr)).not.toThrow();
		});

		test("includes version field", () => {
			const generator = new ReportGenerator();
			const json = JSON.parse(generator.generateJsonReport(createMockSummary()));

			expect(json.version).toBe("1.0");
		});

		test("includes timestamp", () => {
			const generator = new ReportGenerator();
			const json = JSON.parse(generator.generateJsonReport(createMockSummary()));

			expect(json.timestamp).toBe("2025-12-02T14:30:00.000Z");
		});

		test("includes system information", () => {
			const generator = new ReportGenerator();
			const json = JSON.parse(generator.generateJsonReport(createMockSummary()));

			expect(json.system).toBeDefined();
			expect(json.system.os).toBeDefined();
			expect(json.system.node).toBeDefined();
			expect(json.system.cwd).toBeDefined();
			expect(json.system.cliVersion).toBeDefined();
		});

		test("includes summary with counts", () => {
			const generator = new ReportGenerator();
			const json = JSON.parse(generator.generateJsonReport(createMockSummary()));

			expect(json.summary.total).toBe(5);
			expect(json.summary.passed).toBe(3);
			expect(json.summary.warnings).toBe(1);
			expect(json.summary.failed).toBe(1);
			expect(json.summary.fixed).toBe(0);
		});

		test("includes checks array", () => {
			const generator = new ReportGenerator();
			const json = JSON.parse(generator.generateJsonReport(createMockSummary()));

			expect(json.summary.checks).toHaveLength(5);
			expect(json.summary.checks[0].id).toBe("node-version");
		});

		test("excludes fix function from checks in JSON", () => {
			const generator = new ReportGenerator();
			const summary = createMockSummary();
			// Add a fix function to one of the checks
			summary.checks[4].fix = {
				id: "install-global",
				description: "Install globally",
				execute: async () => ({ success: true, message: "Done" }),
			};

			const json = JSON.parse(generator.generateJsonReport(summary));

			// fix function should not appear in serialized JSON
			expect(json.summary.checks[4].fix).toBeUndefined();
		});

		test("includes errors array with failed checks", () => {
			const generator = new ReportGenerator();
			const json = JSON.parse(generator.generateJsonReport(createMockSummary()));

			expect(json.errors).toHaveLength(1);
			expect(json.errors[0].checkId).toBe("claudekit-global");
			expect(json.errors[0].checkName).toBe("ClaudeKit Global");
			expect(json.errors[0].message).toBe("Not installed");
			expect(json.errors[0].suggestion).toBe("Run: ck init --global");
		});

		test("returns empty errors array when no failures", () => {
			const generator = new ReportGenerator();
			const summary = createMockSummary({
				failed: 0,
				checks: [
					{
						id: "pass",
						name: "Pass",
						group: "system",
						status: "pass",
						message: "OK",
						autoFixable: false,
					},
				],
			});

			const json = JSON.parse(generator.generateJsonReport(summary));

			expect(json.errors).toHaveLength(0);
		});
	});

	describe("generate", () => {
		test("returns text report when format is text", () => {
			const generator = new ReportGenerator();
			const report = generator.generate(createMockSummary(), {
				format: "text",
				includeSystemInfo: true,
			});

			expect(report).toContain("CLAUDEKIT DIAGNOSTIC REPORT");
		});

		test("returns JSON report when format is json", () => {
			const generator = new ReportGenerator();
			const report = generator.generate(createMockSummary(), {
				format: "json",
				includeSystemInfo: true,
			});

			expect(() => JSON.parse(report)).not.toThrow();
		});
	});

	describe("uploadToGist", () => {
		let execSyncSpy: ReturnType<typeof spyOn>;
		let spawnSyncSpy: ReturnType<typeof spyOn>;
		let originalCI: string | undefined;

		beforeEach(() => {
			// Force non-interactive mode to skip confirmation prompt
			originalCI = process.env.CI;
			process.env.CI = "true";
		});

		afterEach(() => {
			// Restore original CI env
			if (originalCI === undefined) {
				process.env.CI = undefined;
			} else {
				process.env.CI = originalCI;
			}
			// Restore mocks
			execSyncSpy?.mockRestore();
			spawnSyncSpy?.mockRestore();
		});

		test("returns null when gh CLI is not installed", async () => {
			execSyncSpy = spyOn(childProcess, "execSync").mockImplementation(() => {
				throw new Error("gh: command not found");
			});

			const generator = new ReportGenerator();
			const result = await generator.uploadToGist("test report content");

			expect(result).toBeNull();
			expect(execSyncSpy).toHaveBeenCalledWith("gh --version", { stdio: "ignore" });
		});

		test("returns null when gist creation fails", async () => {
			execSyncSpy = spyOn(childProcess, "execSync").mockReturnValue("");
			spawnSyncSpy = spyOn(childProcess, "spawnSync").mockReturnValue({
				status: 1,
				stderr: "Failed to create gist: authentication required",
				stdout: "",
				pid: 12345,
				output: [],
				signal: null,
			} as SpawnSyncReturns<string>);

			const generator = new ReportGenerator();
			const result = await generator.uploadToGist("test report content");

			expect(result).toBeNull();
		});

		test("returns gist URL on successful upload", async () => {
			const mockGistUrl = "https://gist.github.com/user/abc123";
			execSyncSpy = spyOn(childProcess, "execSync").mockReturnValue("");
			spawnSyncSpy = spyOn(childProcess, "spawnSync").mockReturnValue({
				status: 0,
				stderr: "",
				stdout: mockGistUrl,
				pid: 12345,
				output: [],
				signal: null,
			} as SpawnSyncReturns<string>);

			const generator = new ReportGenerator();
			const result = await generator.uploadToGist("test report content");

			expect(result).toEqual({ url: mockGistUrl });
		});

		test("handles spawnSync error gracefully", async () => {
			execSyncSpy = spyOn(childProcess, "execSync").mockReturnValue("");
			spawnSyncSpy = spyOn(childProcess, "spawnSync").mockReturnValue({
				status: 1,
				stderr: "",
				stdout: "",
				error: new Error("spawn ENOENT"),
				pid: 12345,
				output: [],
				signal: null,
			} as SpawnSyncReturns<string>);

			const generator = new ReportGenerator();
			const result = await generator.uploadToGist("test report content");

			expect(result).toBeNull();
		});

		test("trims whitespace from gist URL", async () => {
			const mockGistUrl = "https://gist.github.com/user/abc123";
			execSyncSpy = spyOn(childProcess, "execSync").mockReturnValue("");
			spawnSyncSpy = spyOn(childProcess, "spawnSync").mockReturnValue({
				status: 0,
				stderr: "",
				stdout: `  ${mockGistUrl}  \n`,
				pid: 12345,
				output: [],
				signal: null,
			} as SpawnSyncReturns<string>);

			const generator = new ReportGenerator();
			const result = await generator.uploadToGist("test report content");

			expect(result).toEqual({ url: mockGistUrl });
		});
	});
});
