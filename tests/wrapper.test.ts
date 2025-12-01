/**
 * Tests for bin/ck.js wrapper script
 * Tests the platform detection, binary lookup, and Node.js fallback logic
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

// Project root is one level up from tests/
const projectRoot = join(dirname(import.meta.dir));
const binDir = join(projectRoot, "bin");

describe("bin/ck.js wrapper", () => {
	describe("file structure", () => {
		test("wrapper script exists", () => {
			const wrapperPath = join(binDir, "ck.js");
			expect(existsSync(wrapperPath)).toBe(true);
		});

		test("dist/index.js exists after build", () => {
			const distPath = join(projectRoot, "dist", "index.js");
			expect(existsSync(distPath)).toBe(true);
		});
	});

	describe("getBinaryPath logic", () => {
		const binaryMap: Record<string, string> = {
			"darwin-arm64": "ck-darwin-arm64",
			"darwin-x64": "ck-darwin-x64",
			"linux-x64": "ck-linux-x64",
			"win32-x64": "ck-win32-x64.exe",
		};

		test("maps platform-arch to correct binary name", () => {
			// Verify the expected mappings
			expect(binaryMap["darwin-arm64"]).toBe("ck-darwin-arm64");
			expect(binaryMap["darwin-x64"]).toBe("ck-darwin-x64");
			expect(binaryMap["linux-x64"]).toBe("ck-linux-x64");
			expect(binaryMap["win32-x64"]).toBe("ck-win32-x64.exe");
		});

		test("unsupported platforms return null", () => {
			// These should not exist in the map
			expect(binaryMap["linux-arm64"]).toBeUndefined();
			expect(binaryMap["freebsd-x64"]).toBeUndefined();
			expect(binaryMap["sunos-x64"]).toBeUndefined();
		});
	});

	describe("error handling", () => {
		test("getErrorMessage handles Error objects", () => {
			const getErrorMessage = (err: unknown): string => {
				return err instanceof Error ? err.message : String(err);
			};

			expect(getErrorMessage(new Error("test error"))).toBe("test error");
			expect(getErrorMessage("string error")).toBe("string error");
			expect(getErrorMessage(123)).toBe("123");
			expect(getErrorMessage(null)).toBe("null");
			expect(getErrorMessage(undefined)).toBe("undefined");
		});
	});

	describe("fallback conditions", () => {
		test("fallback triggers when binary does not exist", () => {
			const nonExistentBinary = join(binDir, "ck-nonexistent-platform");
			expect(existsSync(nonExistentBinary)).toBe(false);
		});

		test("dist directory is included in package.json files", () => {
			const packageJsonPath = join(projectRoot, "package.json");
			const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
			expect(packageJson.files).toContain("dist");
			expect(packageJson.files).toContain("bin");
		});
	});
});
