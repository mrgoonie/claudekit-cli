import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { PackageManagerDetector } from "../../src/lib/package-manager-detector";

const execAsync = promisify(exec);

describe("PackageManagerDetector", () => {
	const originalEnv = { ...process.env };

	beforeEach(() => {
		// Clear relevant env vars
		process.env.npm_config_user_agent = undefined;
		process.env.npm_execpath = undefined;
	});

	afterEach(() => {
		// Restore env
		process.env = { ...originalEnv };
	});

	describe("detect", () => {
		test("detects bun from npm_config_user_agent", async () => {
			process.env.npm_config_user_agent = "bun/1.3.2 npm/? node/v22.11.0 linux x64";
			const pm = await PackageManagerDetector.detect();
			expect(pm).toBe("bun");
		});

		test("detects npm from npm_config_user_agent", async () => {
			process.env.npm_config_user_agent = "npm/10.2.0 node/v20.9.0 linux x64";
			const pm = await PackageManagerDetector.detect();
			expect(pm).toBe("npm");
		});

		test("detects yarn from npm_config_user_agent", async () => {
			process.env.npm_config_user_agent = "yarn/1.22.19 npm/? node/v20.9.0 linux x64";
			const pm = await PackageManagerDetector.detect();
			expect(pm).toBe("yarn");
		});

		test("detects pnpm from npm_config_user_agent", async () => {
			process.env.npm_config_user_agent = "pnpm/8.10.0 npm/? node/v20.9.0 linux x64";
			const pm = await PackageManagerDetector.detect();
			expect(pm).toBe("pnpm");
		});

		test("detects bun from npm_execpath", async () => {
			process.env.npm_execpath = "/home/user/.bun/bin/bun";
			const pm = await PackageManagerDetector.detect();
			expect(pm).toBe("bun");
		});

		test("detects yarn from npm_execpath", async () => {
			process.env.npm_execpath = "/usr/local/lib/node_modules/yarn/bin/yarn.js";
			const pm = await PackageManagerDetector.detect();
			expect(pm).toBe("yarn");
		});

		test("detects pnpm from npm_execpath", async () => {
			process.env.npm_execpath = "/usr/local/lib/node_modules/pnpm/bin/pnpm.cjs";
			const pm = await PackageManagerDetector.detect();
			expect(pm).toBe("pnpm");
		});

		test("detects npm from npm_execpath", async () => {
			process.env.npm_execpath = "/usr/local/lib/node_modules/npm/bin/npm-cli.js";
			const pm = await PackageManagerDetector.detect();
			expect(pm).toBe("npm");
		});

		test("falls back to available package manager when env vars not set", async () => {
			process.env.npm_config_user_agent = undefined;
			process.env.npm_execpath = undefined;
			// This test will detect whatever PM is available on the system
			const pm = await PackageManagerDetector.detect();
			expect(["npm", "bun", "yarn", "pnpm"]).toContain(pm);
		});
	});

	describe("isAvailable", () => {
		test("returns true for available package manager", async () => {
			// Test against a package manager that should be available in the test environment
			const npmAvailable = await PackageManagerDetector.isAvailable("npm");
			const bunAvailable = await PackageManagerDetector.isAvailable("bun");
			// At least one should be available
			expect(npmAvailable || bunAvailable).toBe(true);
		});

		test("returns false for unknown package manager", async () => {
			const result = await PackageManagerDetector.isAvailable("unknown");
			expect(result).toBe(false);
		});
	});

	describe("getUpdateCommand", () => {
		test("returns correct npm update command", () => {
			const cmd = PackageManagerDetector.getUpdateCommand("npm", "test-package", "1.0.0");
			expect(cmd).toContain("npm");
			expect(cmd).toContain("install");
			expect(cmd).toContain("-g");
			expect(cmd).toContain("test-package@1.0.0");
		});

		test("returns correct npm update command with latest", () => {
			const cmd = PackageManagerDetector.getUpdateCommand("npm", "test-package");
			expect(cmd).toContain("test-package@latest");
		});

		test("returns correct bun update command", () => {
			const cmd = PackageManagerDetector.getUpdateCommand("bun", "test-package", "2.0.0");
			expect(cmd).toBe("bun add -g test-package@2.0.0");
		});

		test("returns correct yarn update command", () => {
			const cmd = PackageManagerDetector.getUpdateCommand("yarn", "test-package", "1.5.0");
			expect(cmd).toContain("yarn");
			expect(cmd).toContain("global");
			expect(cmd).toContain("add");
			expect(cmd).toContain("test-package@1.5.0");
		});

		test("returns correct pnpm update command", () => {
			const cmd = PackageManagerDetector.getUpdateCommand("pnpm", "test-package", "3.0.0");
			expect(cmd).toContain("pnpm");
			expect(cmd).toContain("add");
			expect(cmd).toContain("-g");
			expect(cmd).toContain("test-package@3.0.0");
		});

		test("defaults to npm for unknown package manager", () => {
			const cmd = PackageManagerDetector.getUpdateCommand("unknown", "test-package");
			expect(cmd).toContain("npm");
		});
	});

	describe("getInstallCommand", () => {
		test("returns same as update command", () => {
			const updateCmd = PackageManagerDetector.getUpdateCommand("npm", "pkg", "1.0.0");
			const installCmd = PackageManagerDetector.getInstallCommand("npm", "pkg", "1.0.0");
			expect(updateCmd).toBe(installCmd);
		});
	});

	describe("getDisplayName", () => {
		test("returns npm for npm", () => {
			expect(PackageManagerDetector.getDisplayName("npm")).toBe("npm");
		});

		test("returns Bun for bun", () => {
			expect(PackageManagerDetector.getDisplayName("bun")).toBe("Bun");
		});

		test("returns Yarn for yarn", () => {
			expect(PackageManagerDetector.getDisplayName("yarn")).toBe("Yarn");
		});

		test("returns pnpm for pnpm", () => {
			expect(PackageManagerDetector.getDisplayName("pnpm")).toBe("pnpm");
		});

		test("returns Unknown for unknown", () => {
			expect(PackageManagerDetector.getDisplayName("unknown")).toBe("Unknown");
		});
	});

	describe("getVersion", () => {
		test("returns version for available package manager", async () => {
			// Test with bun since we're running in bun
			const version = await PackageManagerDetector.getVersion("bun");
			if (version) {
				// Version should be in semver format
				expect(version).toMatch(/^\d+\.\d+/);
			}
		});

		test("returns null for unknown package manager", async () => {
			const version = await PackageManagerDetector.getVersion("unknown");
			expect(version).toBeNull();
		});
	});
});
