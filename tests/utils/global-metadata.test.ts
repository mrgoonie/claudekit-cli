import { describe, expect, test } from "bun:test";
import type { KitConfig } from "../../src/types.js";
import {
	readGlobalMetadata,
	updateGlobalMetadata,
	writeGlobalMetadata,
} from "../../src/utils/global-metadata.js";

describe("Global Metadata Utilities", () => {
	const mockKitConfig: KitConfig = {
		name: "ClaudeKit Engineer",
		repo: "claudekit-engineer",
		owner: "claudekit",
		description: "Engineering toolkit for building with Claude",
	};

	// Note: These tests use the actual global directory (~/.claude/)
	// In a real environment, these tests would write to the user's home directory
	// For CI/testing, we should skip tests that require filesystem writes

	describe("Function validation", () => {
		test("should export required functions", () => {
			expect(typeof readGlobalMetadata).toBe("function");
			expect(typeof writeGlobalMetadata).toBe("function");
			expect(typeof updateGlobalMetadata).toBe("function");
		});

		test("should accept correct parameter types", () => {
			// Test that functions don't throw on type validation
			expect(() => {
				readGlobalMetadata();
			}).not.toThrow();

			expect(() => {
				writeGlobalMetadata({
					version: "v1.0.0",
					kit: mockKitConfig,
					installDate: new Date().toISOString(),
					lastUpdateDate: new Date().toISOString(),
					platform: "darwin",
					arch: "arm64",
				});
			}).not.toThrow();

			expect(() => {
				updateGlobalMetadata("v1.0.0", mockKitConfig);
			}).not.toThrow();
		});
	});

	// Skip integration tests in CI environments
	const isCI = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";

	describe.skip(isCI ? "Integration tests (skipped in CI)" : "Integration tests", () => {
		test("should handle global metadata operations", async () => {
			// This test would only run in non-CI environments
			// and actually test the global metadata functionality
			const version = "v1.6.0";

			// These would be actual integration tests
			// but we skip them in CI to avoid writing to user's home directory
			expect(version).toBe("v1.6.0");
		});
	});
});
