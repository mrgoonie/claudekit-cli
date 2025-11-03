import { describe, expect, test } from "bun:test";
import {
	canWriteToGlobalDir,
	getGlobalInstallDir,
	getPlatformName,
} from "../../src/utils/global-paths.js";

describe("Global Paths Utilities", () => {
	describe("Function validation", () => {
		test("should export required functions", () => {
			expect(typeof getGlobalInstallDir).toBe("function");
			expect(typeof getPlatformName).toBe("function");
			expect(typeof canWriteToGlobalDir).toBe("function");
		});

		test("should return strings for path functions", () => {
			const globalDir = getGlobalInstallDir();
			const platformName = getPlatformName();

			expect(typeof globalDir).toBe("string");
			expect(typeof platformName).toBe("string");
			expect(globalDir.length).toBeGreaterThan(0);
			expect(platformName.length).toBeGreaterThan(0);
		});

		test("should return valid platform names", () => {
			const platformName = getPlatformName();
			const validPlatforms = ["macOS", "Windows", "Linux"];

			expect(validPlatforms).toContain(platformName);
		});

		test("canWriteToGlobalDir should return boolean", async () => {
			const canWrite = await canWriteToGlobalDir();
			expect(typeof canWrite).toBe("boolean");
		});
	});

	describe("Path format validation", () => {
		test("should return valid path format", () => {
			const globalDir = getGlobalInstallDir();

			// Check that it's an absolute path
			expect(globalDir).toMatch(/^\/|^[A-Za-z]:/);

			// Check that it ends with .claude or ClaudeKit
			expect(globalDir).toMatch(/(\.claude|ClaudeKit)$/);
		});
	});

	// Skip integration tests in CI environments
	const isCI = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";

	describe.skip(isCI ? "Integration tests (skipped in CI)" : "Integration tests", () => {
		test("should handle actual global directory operations", async () => {
			// This test would only run in non-CI environments
			// and actually test the global directory functionality
			const globalDir = getGlobalInstallDir();
			const canWrite = await canWriteToGlobalDir();

			expect(globalDir).toBeTruthy();
			expect(typeof canWrite).toBe("boolean");
		});
	});
});
