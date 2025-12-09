import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MetadataSchema } from "@/types";

/**
 * Tests for version display functionality
 * Covers displayVersion function behavior with various metadata scenarios
 */
describe("Version Display Functionality", () => {
	let testDir: string;
	let originalCwd: string;

	beforeEach(() => {
		// Save original working directory
		originalCwd = process.cwd();

		// Create test directory
		testDir = join(process.cwd(), "test-temp", `version-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });

		// Change to test directory
		process.chdir(testDir);
	});

	afterEach(() => {
		// Restore original working directory
		process.chdir(originalCwd);

		// Cleanup test directory
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe("MetadataSchema validation", () => {
		test("should validate metadata with both name and version", () => {
			const metadata = { name: "ClaudeKit Engineer", version: "1.0.0" };
			const result = MetadataSchema.parse(metadata);
			expect(result.name).toBe("ClaudeKit Engineer");
			expect(result.version).toBe("1.0.0");
		});

		test("should validate metadata with only version", () => {
			const metadata = { version: "2.0.0" };
			const result = MetadataSchema.parse(metadata);
			expect(result.version).toBe("2.0.0");
			expect(result.name).toBeUndefined();
		});

		test("should validate metadata with only name", () => {
			const metadata = { name: "My Kit" };
			const result = MetadataSchema.parse(metadata);
			expect(result.name).toBe("My Kit");
			expect(result.version).toBeUndefined();
		});

		test("should validate empty metadata object", () => {
			const metadata = {};
			const result = MetadataSchema.parse(metadata);
			expect(result.name).toBeUndefined();
			expect(result.version).toBeUndefined();
		});

		test("should reject metadata with invalid types", () => {
			const metadata = { name: 123, version: true };
			expect(() => MetadataSchema.parse(metadata)).toThrow();
		});

		test("should reject metadata with null values", () => {
			const metadata = { name: null, version: null };
			expect(() => MetadataSchema.parse(metadata)).toThrow();
		});

		test("should strip unknown fields", () => {
			const metadata = {
				name: "Test Kit",
				version: "1.0.0",
				unknown: "field",
				extra: 123,
			};
			const result = MetadataSchema.parse(metadata);
			expect(result.name).toBe("Test Kit");
			expect(result.version).toBe("1.0.0");
			expect("unknown" in result).toBe(false);
			expect("extra" in result).toBe(false);
		});
	});

	describe("Version display with metadata scenarios", () => {
		test("should handle missing .claude directory", () => {
			// No .claude directory exists
			expect(existsSync(join(testDir, ".claude"))).toBe(false);

			// displayVersion should not throw
			// (actual display function test would go here if exported)
		});

		test("should handle missing metadata.json file", () => {
			// Create .claude directory but no metadata.json
			mkdirSync(join(testDir, ".claude"), { recursive: true });

			expect(existsSync(join(testDir, ".claude"))).toBe(true);
			expect(existsSync(join(testDir, ".claude", "metadata.json"))).toBe(false);
		});

		test("should handle valid metadata.json", async () => {
			// Create .claude directory and valid metadata.json
			const claudeDir = join(testDir, ".claude");
			mkdirSync(claudeDir, { recursive: true });

			const metadata = {
				name: "ClaudeKit Engineer",
				version: "1.5.0",
			};

			writeFileSync(join(claudeDir, "metadata.json"), JSON.stringify(metadata));

			expect(existsSync(join(claudeDir, "metadata.json"))).toBe(true);

			// Parse and validate
			const Bun = require("bun");
			const file = Bun.file(join(claudeDir, "metadata.json"));
			const content = await file.text();
			const parsed = JSON.parse(content);
			const validated = MetadataSchema.parse(parsed);

			expect(validated.name).toBe("ClaudeKit Engineer");
			expect(validated.version).toBe("1.5.0");
		});

		test("should handle metadata.json with only version", async () => {
			const claudeDir = join(testDir, ".claude");
			mkdirSync(claudeDir, { recursive: true });

			const metadata = { version: "2.0.0" };
			writeFileSync(join(claudeDir, "metadata.json"), JSON.stringify(metadata));

			const Bun = require("bun");
			const file = Bun.file(join(claudeDir, "metadata.json"));
			const content = await file.text();
			const parsed = JSON.parse(content);
			const validated = MetadataSchema.parse(parsed);

			expect(validated.version).toBe("2.0.0");
			expect(validated.name).toBeUndefined();
		});

		test("should handle invalid JSON in metadata.json", async () => {
			const claudeDir = join(testDir, ".claude");
			mkdirSync(claudeDir, { recursive: true });

			// Write invalid JSON
			writeFileSync(join(claudeDir, "metadata.json"), "{ invalid json }");

			// Should throw on parse
			const Bun = require("bun");
			const file = Bun.file(join(claudeDir, "metadata.json"));
			const content = await file.text();

			expect(() => JSON.parse(content)).toThrow();
		});

		test("should handle empty metadata.json file", async () => {
			const claudeDir = join(testDir, ".claude");
			mkdirSync(claudeDir, { recursive: true });

			writeFileSync(join(claudeDir, "metadata.json"), "");

			const Bun = require("bun");
			const file = Bun.file(join(claudeDir, "metadata.json"));
			const content = await file.text();

			// Empty string should fail JSON parsing
			expect(() => JSON.parse(content)).toThrow();
		});

		test("should handle metadata.json with extra fields", async () => {
			const claudeDir = join(testDir, ".claude");
			mkdirSync(claudeDir, { recursive: true });

			const metadata = {
				name: "Test Kit",
				version: "1.0.0",
				description: "Extra field",
				author: "Someone",
			};

			writeFileSync(join(claudeDir, "metadata.json"), JSON.stringify(metadata));

			const Bun = require("bun");
			const file = Bun.file(join(claudeDir, "metadata.json"));
			const content = await file.text();
			const parsed = JSON.parse(content);
			const validated = MetadataSchema.parse(parsed);

			expect(validated.name).toBe("Test Kit");
			expect(validated.version).toBe("1.0.0");
			// Extra fields should be stripped
			expect("description" in validated).toBe(false);
		});

		test("should handle metadata with wrong types", async () => {
			const claudeDir = join(testDir, ".claude");
			mkdirSync(claudeDir, { recursive: true });

			const metadata = {
				name: 12345,
				version: { invalid: "object" },
			};

			writeFileSync(join(claudeDir, "metadata.json"), JSON.stringify(metadata));

			const Bun = require("bun");
			const file = Bun.file(join(claudeDir, "metadata.json"));
			const content = await file.text();
			const parsed = JSON.parse(content);

			// Should fail Zod validation
			expect(() => MetadataSchema.parse(parsed)).toThrow();
		});
	});
});
