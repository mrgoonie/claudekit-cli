import { describe, expect, test } from "bun:test";

/**
 * Unit tests for the compareVersions function logic used in SystemChecker
 * We test the version comparison algorithm directly rather than mocking exec
 */
describe("SystemChecker - Version Comparison Logic", () => {
	// Replicate the compareVersions function for testing
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

	const MIN_GH_CLI_VERSION = "2.20.0";

	describe("compareVersions", () => {
		test("returns -1 when first version is lower (2.4.0 < 2.20.0)", () => {
			expect(compareVersions("2.4.0", "2.20.0")).toBe(-1);
		});

		test("returns -1 when first version is lower (2.19.9 < 2.20.0)", () => {
			expect(compareVersions("2.19.9", "2.20.0")).toBe(-1);
		});

		test("returns 0 when versions are equal", () => {
			expect(compareVersions("2.20.0", "2.20.0")).toBe(0);
		});

		test("returns 1 when first version is higher (2.63.0 > 2.20.0)", () => {
			expect(compareVersions("2.63.0", "2.20.0")).toBe(1);
		});

		test("returns 1 when first version is higher (2.20.1 > 2.20.0)", () => {
			expect(compareVersions("2.20.1", "2.20.0")).toBe(1);
		});

		test("handles different version lengths (2.4 vs 2.4.0)", () => {
			expect(compareVersions("2.4", "2.4.0")).toBe(0);
		});

		test("handles major version differences (3.0.0 > 2.99.99)", () => {
			expect(compareVersions("3.0.0", "2.99.99")).toBe(1);
		});
	});

	describe("version check logic", () => {
		test("v2.4.0 is below minimum and should trigger warning", () => {
			const version = "2.4.0";
			const isBelowMinimum = compareVersions(version, MIN_GH_CLI_VERSION) < 0;
			expect(isBelowMinimum).toBe(true);
		});

		test("v2.19.9 is below minimum and should trigger warning", () => {
			const version = "2.19.9";
			const isBelowMinimum = compareVersions(version, MIN_GH_CLI_VERSION) < 0;
			expect(isBelowMinimum).toBe(true);
		});

		test("v2.20.0 meets minimum and should pass", () => {
			const version = "2.20.0";
			const isBelowMinimum = compareVersions(version, MIN_GH_CLI_VERSION) < 0;
			expect(isBelowMinimum).toBe(false);
		});

		test("v2.63.0 exceeds minimum and should pass", () => {
			const version = "2.63.0";
			const isBelowMinimum = compareVersions(version, MIN_GH_CLI_VERSION) < 0;
			expect(isBelowMinimum).toBe(false);
		});
	});
});
