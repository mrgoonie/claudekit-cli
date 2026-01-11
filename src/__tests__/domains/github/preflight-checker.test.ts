/**
 * Tests for GitHub CLI pre-flight checker and shared utilities
 * Note: Integration tests are skipped in CI where gh CLI may not be available
 */
import { describe, expect, test } from "bun:test";
import {
	GH_COMMAND_TIMEOUT_MS,
	MIN_GH_CLI_VERSION,
	compareVersions,
	getGhUpgradeInstructions,
	shouldSkipExpensiveOperations,
} from "@/domains/github/gh-cli-utils.js";

describe("gh-cli-utils", () => {
	describe("compareVersions", () => {
		test("should correctly compare versions with same major", () => {
			expect(compareVersions("2.4.0", "2.20.0")).toBe(-1);
			expect(compareVersions("2.20.0", "2.4.0")).toBe(1);
			expect(compareVersions("2.20.0", "2.20.0")).toBe(0);
		});

		test("should correctly compare versions with different major", () => {
			expect(compareVersions("1.99.0", "2.0.0")).toBe(-1);
			expect(compareVersions("3.0.0", "2.20.0")).toBe(1);
		});

		test("should correctly compare patch versions", () => {
			expect(compareVersions("2.19.1", "2.20.0")).toBe(-1);
			expect(compareVersions("2.20.1", "2.20.0")).toBe(1);
		});

		test("should accept minimum version 2.20.0", () => {
			expect(compareVersions("2.20.0", MIN_GH_CLI_VERSION) >= 0).toBe(true);
			expect(compareVersions("2.19.1", MIN_GH_CLI_VERSION) >= 0).toBe(false);
			expect(compareVersions("2.40.0", MIN_GH_CLI_VERSION) >= 0).toBe(true);
			expect(compareVersions("3.0.0", MIN_GH_CLI_VERSION) >= 0).toBe(true);
		});
	});

	describe("shouldSkipExpensiveOperations", () => {
		test("should return boolean", () => {
			const result = shouldSkipExpensiveOperations();
			expect(typeof result).toBe("boolean");
		});
	});

	describe("constants", () => {
		test("MIN_GH_CLI_VERSION should be 2.20.0", () => {
			expect(MIN_GH_CLI_VERSION).toBe("2.20.0");
		});

		test("GH_COMMAND_TIMEOUT_MS should be 10 seconds", () => {
			expect(GH_COMMAND_TIMEOUT_MS).toBe(10000);
		});
	});

	describe("getGhUpgradeInstructions", () => {
		test("should include version info in output", () => {
			const lines = getGhUpgradeInstructions("2.4.0");
			expect(lines.some((l) => l.includes("2.4.0"))).toBe(true);
			expect(lines.some((l) => l.includes(MIN_GH_CLI_VERSION))).toBe(true);
		});

		test("should include post-upgrade auth reminder", () => {
			const lines = getGhUpgradeInstructions("2.4.0");
			expect(lines.some((l) => l.includes("gh auth login"))).toBe(true);
		});

		test("should return array of strings", () => {
			const lines = getGhUpgradeInstructions("2.4.0");
			expect(Array.isArray(lines)).toBe(true);
			expect(lines.length).toBeGreaterThan(0);
			expect(lines.every((l) => typeof l === "string")).toBe(true);
		});

		test("should include platform-appropriate instructions based on process.platform", () => {
			const lines = getGhUpgradeInstructions("2.4.0");
			// Should always have some upgrade command regardless of platform
			const hasUpgradeCommand =
				lines.some((l) => l.includes("brew")) ||
				lines.some((l) => l.includes("apt")) ||
				lines.some((l) => l.includes("winget")) ||
				lines.some((l) => l.includes("cli.github.com"));
			expect(hasUpgradeCommand).toBe(true);
		});
	});
});

describe("preflight-checker", () => {
	describe("platform detection", () => {
		test("should identify platform correctly", () => {
			const platform = process.platform;
			expect(["darwin", "linux", "win32"]).toContain(platform);
		});
	});

	describe("integration smoke test", () => {
		// Skip in CI - gh CLI may not be available or may hang
		const isCI = process.env.CI === "true";

		test.skipIf(isCI)("should run without crashing", async () => {
			// This will use actual gh CLI if available
			const { runPreflightChecks } = await import("@/domains/github/preflight-checker.js");
			const result = await runPreflightChecks();

			// Should always return a valid result structure
			expect(result).toHaveProperty("success");
			expect(result).toHaveProperty("ghInstalled");
			expect(result).toHaveProperty("ghVersion");
			expect(result).toHaveProperty("ghVersionOk");
			expect(result).toHaveProperty("ghAuthenticated");
			expect(result).toHaveProperty("errorLines");
			expect(Array.isArray(result.errorLines)).toBe(true);

			// If gh is installed, version should be a string
			if (result.ghInstalled) {
				expect(typeof result.ghVersion).toBe("string");
			} else {
				expect(result.ghVersion).toBe(null);
			}
		});
	});
});
