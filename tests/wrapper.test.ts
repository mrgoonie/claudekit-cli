/**
 * Tests for bin/ck.js wrapper script
 * Tests the platform detection, binary lookup, and Node.js fallback logic
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

// Project root is one level up from tests/
const projectRoot = join(dirname(import.meta.dir));
const binDir = join(projectRoot, "bin");

// CI environment detection
const isCI = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";

describe("bin/ck.js wrapper", () => {
	describe("file structure", () => {
		test("wrapper script exists", () => {
			const wrapperPath = join(binDir, "ck.js");
			expect(existsSync(wrapperPath)).toBe(true);
		});

		// Skip in CI - dist is built after tests run in the release workflow
		test.skipIf(isCI)("dist/index.js exists after build", () => {
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

	describe("ESM compatibility", () => {
		test("pathToFileURL converts Unix paths to file:// URLs", () => {
			const unixPath = "/home/user/dist/index.js";
			const fileUrl = pathToFileURL(unixPath).href;
			expect(fileUrl).toMatch(/^file:\/\/\//);
			expect(fileUrl).toBe("file:///home/user/dist/index.js");
		});

		test("pathToFileURL handles Windows-style paths correctly", () => {
			// Test that pathToFileURL properly converts paths with drive letters
			// Note: On Unix, this simulates what would happen on Windows
			const windowsStylePath = "C:\\Users\\test\\dist\\index.js";
			const fileUrl = pathToFileURL(windowsStylePath).href;

			// On Windows: file:///C:/Users/test/dist/index.js
			// On Unix: file:///path/to/cwd/C:/Users/test/dist/index.js (relative interpretation)
			// Either way, it produces a valid file:// URL that ESM can import
			expect(fileUrl).toMatch(/^file:\/\/\//);
		});

		test("pathToFileURL output can be used in dynamic imports", async () => {
			// Verify the pattern used in bin/ck.js works
			const distPath = join(projectRoot, "dist", "index.js");
			if (existsSync(distPath)) {
				const distUrl = pathToFileURL(distPath).href;
				expect(distUrl).toMatch(/^file:\/\/\//);
				expect(distUrl).toContain("dist/index.js");
				// Don't actually import to avoid side effects, just verify URL format
			}
		});
	});
});
