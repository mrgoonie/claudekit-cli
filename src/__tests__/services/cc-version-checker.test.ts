import { describe, expect, test } from "bun:test";

// Test only the pure functions — getCCVersion/requireCCPluginSupport
// call actual `claude` binary which can't be reliably mocked in bun
import { compareVersions, parseVersion } from "@/services/cc-version-checker.js";

describe("parseVersion", () => {
	test("parses standard semver", () => {
		expect(parseVersion("1.0.33")).toEqual([1, 0, 33]);
	});

	test("parses version with extra suffix", () => {
		expect(parseVersion("1.0.35-beta.1")).toEqual([1, 0, 35]);
	});

	test("parses multi-digit segments", () => {
		expect(parseVersion("12.34.56")).toEqual([12, 34, 56]);
	});

	test("returns null for invalid input", () => {
		expect(parseVersion("not-a-version")).toBeNull();
		expect(parseVersion("")).toBeNull();
		expect(parseVersion("abc")).toBeNull();
	});

	test("returns null for partial versions", () => {
		expect(parseVersion("1.0")).toBeNull();
		expect(parseVersion("1")).toBeNull();
	});
});

describe("compareVersions", () => {
	test("equal versions return 0", () => {
		expect(compareVersions("1.0.33", "1.0.33")).toBe(0);
		expect(compareVersions("0.0.0", "0.0.0")).toBe(0);
	});

	test("newer patch returns positive", () => {
		expect(compareVersions("1.0.34", "1.0.33")).toBeGreaterThan(0);
	});

	test("newer minor returns positive", () => {
		expect(compareVersions("1.1.0", "1.0.33")).toBeGreaterThan(0);
	});

	test("newer major returns positive", () => {
		expect(compareVersions("2.0.0", "1.0.33")).toBeGreaterThan(0);
	});

	test("older version returns negative", () => {
		expect(compareVersions("1.0.32", "1.0.33")).toBeLessThan(0);
		expect(compareVersions("0.9.99", "1.0.33")).toBeLessThan(0);
	});

	test("handles invalid versions gracefully", () => {
		expect(compareVersions("invalid", "1.0.33")).toBe(0);
		expect(compareVersions("1.0.33", "invalid")).toBe(0);
	});

	test("version 1.0.33 is >= MIN_PLUGIN_VERSION", () => {
		expect(compareVersions("1.0.33", "1.0.33")).toBeGreaterThanOrEqual(0);
	});

	test("version 1.0.32 is < MIN_PLUGIN_VERSION", () => {
		expect(compareVersions("1.0.32", "1.0.33")).toBeLessThan(0);
	});
});
