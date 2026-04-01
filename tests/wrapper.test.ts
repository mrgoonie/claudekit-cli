/**
 * Tests for bin/ck.js wrapper script.
 * The published wrapper must run the packaged bundle under plain Node.js.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = join(dirname(import.meta.dir));
const binDir = join(projectRoot, "bin");
const distPath = join(projectRoot, "dist", "index.js");

const isCI = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
const hasBuiltDist = existsSync(distPath);

describe("bin/ck.js wrapper", () => {
	describe("file structure", () => {
		test("wrapper script exists", () => {
			expect(existsSync(join(binDir, "ck.js"))).toBe(true);
		});

		test.skipIf(isCI || !hasBuiltDist)("dist/index.js exists after build", () => {
			expect(existsSync(distPath)).toBe(true);
		});
	});

	describe("wrapper content integrity", () => {
		const wrapperContent = readFileSync(join(binDir, "ck.js"), "utf-8");

		test("uses node shebang", () => {
			expect(wrapperContent.startsWith("#!/usr/bin/env node")).toBe(true);
		});

		test("contains no hardcoded developer paths", () => {
			const devPathPattern = /(?:\/Users\/|\/home\/|C:\\Users\\)\w+/;
			expect(wrapperContent).not.toMatch(devPathPattern);
		});

		test("contains expected Node runtime helpers", () => {
			expect(wrapperContent).toContain("runWithNode");
			expect(wrapperContent).toContain("checkNodeVersion");
			expect(wrapperContent).toContain("pathToFileURL");
		});

		test("does not contain Bun runtime fallback logic", () => {
			expect(wrapperContent).not.toContain("runWithBun");
			expect(wrapperContent).not.toContain("hasBun");
			expect(wrapperContent).not.toContain("Install bun");
			expect(wrapperContent).not.toContain("bun:");
		});

		test("is not suspiciously small", () => {
			expect(wrapperContent.length).toBeGreaterThan(600);
		});
	});

	describe("error handling", () => {
		test("getErrorMessage handles Error objects", () => {
			const getErrorMessage = (err: unknown): string =>
				err instanceof Error ? err.message : String(err);

			expect(getErrorMessage(new Error("test error"))).toBe("test error");
			expect(getErrorMessage("string error")).toBe("string error");
			expect(getErrorMessage(123)).toBe("123");
			expect(getErrorMessage(null)).toBe("null");
			expect(getErrorMessage(undefined)).toBe("undefined");
		});

		test("surfaces issue-reporting instructions", () => {
			const wrapperContent = readFileSync(join(binDir, "ck.js"), "utf-8");
			expect(wrapperContent).toContain("Please report this issue at:");
		});
	});

	describe("package distribution", () => {
		test("essential files are included in package.json files", () => {
			const packageJsonPath = join(projectRoot, "package.json");
			const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
			expect(packageJson.files).toContain("dist/index.js");
			expect(packageJson.files).toContain("bin/ck.js");
			expect(packageJson.files).toContain("dist/ui/");
		});

		test("package.json only requires Node at runtime", () => {
			const packageJsonPath = join(projectRoot, "package.json");
			const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
			expect(packageJson.engines.node).toBe(">=18.0.0");
			expect(packageJson.engines.bun).toBeUndefined();
		});

		test("package.json does not include native binaries", () => {
			const packageJsonPath = join(projectRoot, "package.json");
			const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
			const files = packageJson.files as string[];
			const hasBinaryEntries = files.some(
				(f) => f.includes("ck-darwin") || f.includes("ck-linux") || f.includes("ck-win32"),
			);
			expect(hasBinaryEntries).toBe(false);
		});

		test("npmignore does not include binary negation", () => {
			const npmIgnorePath = join(projectRoot, ".npmignore");
			const npmIgnore = readFileSync(npmIgnorePath, "utf-8");
			expect(npmIgnore).not.toMatch(/^!bin\/ck-\*$/m);
		});
	});

	describe("Node.js version check", () => {
		const MIN_NODE_VERSION = [18, 0];

		const checkVersionRequirement = (
			nodeVersion: string,
		): { passes: boolean; major: number; minor: number } => {
			const [major, minor] = nodeVersion.split(".").map(Number);
			const [minMajor, minMinor] = MIN_NODE_VERSION;
			const passes = !(major < minMajor || (major === minMajor && minor < minMinor));
			return { passes, major, minor };
		};

		test("parses version string correctly", () => {
			const result = checkVersionRequirement("22.19.0");
			expect(result.major).toBe(22);
			expect(result.minor).toBe(19);
		});

		test("accepts Node.js 18.0.0 (minimum version)", () => {
			expect(checkVersionRequirement("18.0.0").passes).toBe(true);
		});

		test("accepts Node.js 18.x versions", () => {
			expect(checkVersionRequirement("18.0.0").passes).toBe(true);
			expect(checkVersionRequirement("18.5.0").passes).toBe(true);
			expect(checkVersionRequirement("18.19.1").passes).toBe(true);
		});

		test("accepts Node.js 20.x LTS versions", () => {
			expect(checkVersionRequirement("20.0.0").passes).toBe(true);
			expect(checkVersionRequirement("20.10.0").passes).toBe(true);
			expect(checkVersionRequirement("20.18.2").passes).toBe(true);
		});

		test("accepts Node.js 22.x and newer versions", () => {
			expect(checkVersionRequirement("22.0.0").passes).toBe(true);
			expect(checkVersionRequirement("22.19.0").passes).toBe(true);
			expect(checkVersionRequirement("23.5.0").passes).toBe(true);
			expect(checkVersionRequirement("24.0.0").passes).toBe(true);
		});

		test("rejects Node.js 16.x versions", () => {
			expect(checkVersionRequirement("16.0.0").passes).toBe(false);
			expect(checkVersionRequirement("16.20.2").passes).toBe(false);
		});

		test("rejects Node.js 17.x versions", () => {
			expect(checkVersionRequirement("17.0.0").passes).toBe(false);
			expect(checkVersionRequirement("17.9.1").passes).toBe(false);
		});

		test("rejects very old Node.js versions", () => {
			expect(checkVersionRequirement("14.0.0").passes).toBe(false);
			expect(checkVersionRequirement("12.0.0").passes).toBe(false);
			expect(checkVersionRequirement("10.0.0").passes).toBe(false);
		});

		test("current Node.js version passes the check", () => {
			const currentVersion = process.versions.node;
			const result = checkVersionRequirement(currentVersion);
			expect(result.passes).toBe(true);
		});

		test("MIN_NODE_VERSION is set to [18, 0]", () => {
			expect(MIN_NODE_VERSION).toEqual([18, 0]);
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
			const windowsStylePath = "C:\\Users\\test\\dist\\index.js";
			const fileUrl = pathToFileURL(windowsStylePath).href;
			expect(fileUrl).toMatch(/^file:\/\/\//);
		});

		test("pathToFileURL output can be used in dynamic imports", async () => {
			if (existsSync(distPath)) {
				const distUrl = pathToFileURL(distPath).href;
				expect(distUrl).toMatch(/^file:\/\/\//);
				expect(distUrl).toContain("dist/index.js");
			}
		});
	});
});
