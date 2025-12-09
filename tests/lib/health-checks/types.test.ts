import { describe, expect, test } from "bun:test";
import {
	CheckGroupSchema,
	CheckResultSchema,
	CheckRunnerOptionsSchema,
	CheckStatusSchema,
	CheckSummarySchema,
	FixAttemptSchema,
	FixResultSchema,
	HealingSummarySchema,
} from "../../../src/domains/health-checks/types.js";

describe("Health Check Types - Zod Schema Validation", () => {
	describe("CheckStatusSchema", () => {
		test("accepts valid status values", () => {
			expect(CheckStatusSchema.parse("pass")).toBe("pass");
			expect(CheckStatusSchema.parse("warn")).toBe("warn");
			expect(CheckStatusSchema.parse("fail")).toBe("fail");
			expect(CheckStatusSchema.parse("info")).toBe("info");
		});

		test("rejects invalid status", () => {
			expect(() => CheckStatusSchema.parse("invalid")).toThrow();
			expect(() => CheckStatusSchema.parse("")).toThrow();
			expect(() => CheckStatusSchema.parse(123)).toThrow();
		});
	});

	describe("CheckGroupSchema", () => {
		test("accepts valid group values", () => {
			expect(CheckGroupSchema.parse("system")).toBe("system");
			expect(CheckGroupSchema.parse("claudekit")).toBe("claudekit");
			expect(CheckGroupSchema.parse("auth")).toBe("auth");
		});

		test("rejects invalid group", () => {
			expect(() => CheckGroupSchema.parse("unknown")).toThrow();
			expect(() => CheckGroupSchema.parse("")).toThrow();
		});
	});

	describe("FixResultSchema", () => {
		test("validates valid fix result", () => {
			const result = { success: true, message: "Fixed successfully" };
			expect(() => FixResultSchema.parse(result)).not.toThrow();
		});

		test("validates fix result with details", () => {
			const result = {
				success: false,
				message: "Fix failed",
				details: "Permission denied",
			};
			const parsed = FixResultSchema.parse(result);
			expect(parsed.details).toBe("Permission denied");
		});

		test("rejects missing required fields", () => {
			expect(() => FixResultSchema.parse({ success: true })).toThrow();
			expect(() => FixResultSchema.parse({ message: "test" })).toThrow();
		});
	});

	describe("CheckResultSchema", () => {
		test("validates valid check result", () => {
			const result = {
				id: "node-version",
				name: "Node.js Version",
				group: "system",
				status: "pass",
				message: "Node.js v20.0.0 installed",
				autoFixable: false,
			};
			expect(() => CheckResultSchema.parse(result)).not.toThrow();
		});

		test("validates check result with optional fields", () => {
			const result = {
				id: "gh-cli",
				name: "GitHub CLI",
				group: "auth",
				status: "fail",
				message: "GitHub CLI not installed",
				details: "Required for authentication",
				suggestion: "Run: brew install gh",
				autoFixable: true,
				fixed: false,
				fixError: "Installation failed",
			};
			const parsed = CheckResultSchema.parse(result);
			expect(parsed.suggestion).toBe("Run: brew install gh");
			expect(parsed.fixError).toBe("Installation failed");
		});

		test("rejects empty id or name", () => {
			const result = {
				id: "",
				name: "Test",
				group: "system",
				status: "pass",
				message: "OK",
				autoFixable: false,
			};
			expect(() => CheckResultSchema.parse(result)).toThrow();
		});

		test("rejects invalid status in check result", () => {
			const result = {
				id: "test",
				name: "Test",
				group: "system",
				status: "invalid",
				message: "Test",
				autoFixable: false,
			};
			expect(() => CheckResultSchema.parse(result)).toThrow();
		});

		test("rejects invalid group in check result", () => {
			const result = {
				id: "test",
				name: "Test",
				group: "unknown",
				status: "pass",
				message: "Test",
				autoFixable: false,
			};
			expect(() => CheckResultSchema.parse(result)).toThrow();
		});
	});

	describe("CheckRunnerOptionsSchema", () => {
		test("validates empty options", () => {
			expect(() => CheckRunnerOptionsSchema.parse({})).not.toThrow();
		});

		test("validates full options", () => {
			const options = {
				fix: true,
				checkOnly: false,
				json: true,
				groups: ["system", "auth"],
				verbose: true,
			};
			const parsed = CheckRunnerOptionsSchema.parse(options);
			expect(parsed.fix).toBe(true);
			expect(parsed.groups).toEqual(["system", "auth"]);
		});

		test("rejects invalid group in options", () => {
			const options = { groups: ["system", "invalid"] };
			expect(() => CheckRunnerOptionsSchema.parse(options)).toThrow();
		});
	});

	describe("CheckSummarySchema", () => {
		test("validates valid summary", () => {
			const summary = {
				timestamp: "2025-12-02T14:30:00.000Z",
				total: 5,
				passed: 3,
				warnings: 1,
				failed: 1,
				fixed: 0,
				checks: [
					{
						id: "c1",
						name: "Check 1",
						group: "system",
						status: "pass",
						message: "OK",
						autoFixable: false,
					},
				],
			};
			expect(() => CheckSummarySchema.parse(summary)).not.toThrow();
		});

		test("rejects negative counts", () => {
			const summary = {
				timestamp: "2025-12-02T14:30:00.000Z",
				total: -1,
				passed: 0,
				warnings: 0,
				failed: 0,
				fixed: 0,
				checks: [],
			};
			expect(() => CheckSummarySchema.parse(summary)).toThrow();
		});
	});

	describe("FixAttemptSchema", () => {
		test("validates valid fix attempt", () => {
			const attempt = {
				checkId: "node-version",
				checkName: "Node.js Version",
				fixId: "install-node",
				success: true,
				message: "Node.js installed",
				duration: 5000,
			};
			expect(() => FixAttemptSchema.parse(attempt)).not.toThrow();
		});

		test("validates failed fix attempt with error", () => {
			const attempt = {
				checkId: "gh-cli",
				checkName: "GitHub CLI",
				fixId: "install-gh",
				success: false,
				message: "Installation failed",
				error: "Permission denied",
				duration: 1000,
			};
			const parsed = FixAttemptSchema.parse(attempt);
			expect(parsed.error).toBe("Permission denied");
		});

		test("rejects negative duration", () => {
			const attempt = {
				checkId: "test",
				checkName: "Test",
				fixId: "fix",
				success: true,
				message: "OK",
				duration: -100,
			};
			expect(() => FixAttemptSchema.parse(attempt)).toThrow();
		});
	});

	describe("HealingSummarySchema", () => {
		test("validates valid healing summary", () => {
			const summary = {
				totalFixable: 3,
				attempted: 3,
				succeeded: 2,
				failed: 1,
				fixes: [
					{
						checkId: "c1",
						checkName: "Check 1",
						fixId: "f1",
						success: true,
						message: "Fixed",
						duration: 100,
					},
				],
			};
			expect(() => HealingSummarySchema.parse(summary)).not.toThrow();
		});

		test("validates empty fixes array", () => {
			const summary = {
				totalFixable: 0,
				attempted: 0,
				succeeded: 0,
				failed: 0,
				fixes: [],
			};
			expect(() => HealingSummarySchema.parse(summary)).not.toThrow();
		});
	});
});
