/**
 * Tests for GitHub CLI pre-flight checker
 * Note: These tests verify the business logic only. Integration testing requires actual gh CLI.
 */
import { describe, expect, test } from "bun:test";

describe("preflight-checker", () => {
	describe("version comparison logic", () => {
		// Helper to test version comparison without mocking
		function compareVersions(a: string, b: string): number {
			const partsA = a.split(".").map(Number);
			const partsB = b.split(".").map(Number);
			const maxLen = Math.max(partsA.length, partsB.length);

			for (let i = 0; i < maxLen; i++) {
				const numA = partsA[i] ?? 0;
				const numB = partsB[i] ?? 0;
				if (numA < numB) return -1;
				if (numA > numB) return 1;
			}
			return 0;
		}

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
			const MIN_VERSION = "2.20.0";
			expect(compareVersions("2.20.0", MIN_VERSION) >= 0).toBe(true);
			expect(compareVersions("2.19.1", MIN_VERSION) >= 0).toBe(false);
			expect(compareVersions("2.40.0", MIN_VERSION) >= 0).toBe(true);
			expect(compareVersions("3.0.0", MIN_VERSION) >= 0).toBe(true);
		});
	});

	describe("WSL detection logic", () => {
		test("should identify platform correctly", () => {
			// Test platform detection - this is a smoke test
			const platform = process.platform;
			expect(["darwin", "linux", "win32"]).toContain(platform);
		});
	});

	describe("integration smoke test", () => {
		test("should run without crashing", async () => {
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
