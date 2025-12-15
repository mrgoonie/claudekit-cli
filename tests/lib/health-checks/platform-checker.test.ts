import { afterEach, beforeEach, describe, expect, test } from "bun:test";

// Store original values
const originalEnv = process.env;
const originalCwd = process.cwd;

describe("PlatformChecker", () => {
	let tempFiles: string[] = [];

	beforeEach(() => {
		// Reset process.env
		process.env = { ...originalEnv };

		// Clear temp files array
		tempFiles = [];
	});

	afterEach(async () => {
		// Restore process.env
		process.env = originalEnv;
		process.cwd = originalCwd;

		// Clean up any temp files created during tests
		for (const file of tempFiles) {
			try {
				await import("node:fs/promises").then(({ unlink }) => unlink(file));
			} catch {
				// Ignore cleanup errors
			}
		}
	});

	describe("run", () => {
		test("executes all checks on current platform", async () => {
			const { PlatformChecker } = await import(
				"../../../src/domains/health-checks/platform-checker.js"
			);
			const checker = new PlatformChecker();

			const results = await checker.run();

			// Should have at least the basic checks
			expect(results.length).toBeGreaterThan(0);

			// All results should have the correct structure
			for (const result of results) {
				expect(result).toHaveProperty("id");
				expect(result).toHaveProperty("name");
				expect(result).toHaveProperty("group", "platform");
				expect(result).toHaveProperty("priority");
				expect(result).toHaveProperty("status");
				expect(result).toHaveProperty("message");
				expect(result).toHaveProperty("autoFixable", false);
			}

			// Check for basic checks that should always be present
			const checkIds = results.map((r: any) => r.id);
			expect(checkIds).toContain("platform-detect");
			expect(checkIds).toContain("home-dir-resolution");
			expect(checkIds).toContain("global-dir-access");
			expect(checkIds).toContain("shell-detection");
		});
	});

	describe("checkPlatformDetect", () => {
		test("returns valid platform information", async () => {
			const { PlatformChecker } = await import(
				"../../../src/domains/health-checks/platform-checker.js"
			);
			const checker = new PlatformChecker();

			// Access private method
			const result = await (checker as any).checkPlatformDetect();

			expect(result.id).toBe("platform-detect");
			expect(result.name).toBe("Platform");
			expect(result.status).toBe("info");
			expect(result.autoFixable).toBe(false);
			expect(result.message).toMatch(/^(linux|darwin|win32) \([a-z0-9_]+\)( - WSL: .*)?$/);
		});
	});

	describe("checkHomeDirResolution", () => {
		test("compares Node home directory with environment", async () => {
			const { PlatformChecker } = await import(
				"../../../src/domains/health-checks/platform-checker.js"
			);
			const checker = new PlatformChecker();

			const result = await (checker as any).checkHomeDirResolution();

			expect(result.id).toBe("home-dir-resolution");
			expect(result.name).toBe("Home Directory");
			expect(result.autoFixable).toBe(false);
			expect(["pass", "warn"]).toContain(result.status);

			if (result.status === "warn") {
				expect(result.message).toContain("Mismatch:");
				expect(result.suggestion).toBeDefined();
			}
		});
	});

	describe("checkShellDetection", () => {
		test("detects shell from environment", async () => {
			const { PlatformChecker } = await import(
				"../../../src/domains/health-checks/platform-checker.js"
			);
			const checker = new PlatformChecker();

			const result = await (checker as any).checkShellDetection();

			expect(result.id).toBe("shell-detection");
			expect(result.name).toBe("Shell");
			expect(result.status).toBe("info");
			expect(result.autoFixable).toBe(false);
			expect([
				"Bash",
				"Zsh",
				"Fish",
				"PowerShell Core",
				"Windows PowerShell",
				"Command Prompt",
				"Unknown",
			]).toContain(result.message);
			expect(result.details).toBeDefined();
		});
	});

	describe("isWSL", () => {
		test("detects WSL via WSL_DISTRO_NAME", async () => {
			process.env.WSL_DISTRO_NAME = "Ubuntu";

			const { PlatformChecker } = await import(
				"../../../src/domains/health-checks/platform-checker.js"
			);
			const checker = new PlatformChecker();

			const isWSL = (checker as any).isWSL();
			expect(isWSL).toBe(true);
		});

		test("detects WSL via WSLENV", async () => {
			process.env.WSL_DISTRO_NAME = undefined;
			process.env.WSLENV = "PATH/l";

			const { PlatformChecker } = await import(
				"../../../src/domains/health-checks/platform-checker.js"
			);
			const checker = new PlatformChecker();

			const isWSL = (checker as any).isWSL();
			expect(isWSL).toBe(true);
		});

		test("returns false when not in WSL", async () => {
			process.env.WSL_DISTRO_NAME = undefined;
			process.env.WSLENV = undefined;

			const { PlatformChecker } = await import(
				"../../../src/domains/health-checks/platform-checker.js"
			);
			const checker = new PlatformChecker();

			const isWSL = (checker as any).isWSL();
			expect(isWSL).toBe(false);
		});
	});

	// Tests for Windows-specific functionality
	describe("Windows-specific checks", () => {
		test("skips env-var-expansion on non-Windows", async () => {
			const { platform } = await import("node:os");

			// Only run this test on non-Windows systems
			if (platform() !== "win32") {
				const { PlatformChecker } = await import(
					"../../../src/domains/health-checks/platform-checker.js"
				);
				const checker = new PlatformChecker();
				const results = await checker.run();

				const checkIds = results.map((r: any) => r.id);
				expect(checkIds).not.toContain("env-var-expansion");
			} else {
				// On Windows, verify the check exists
				const { PlatformChecker } = await import(
					"../../../src/domains/health-checks/platform-checker.js"
				);
				const checker = new PlatformChecker();
				const results = await checker.run();

				const checkIds = results.map((r: any) => r.id);
				expect(checkIds).toContain("env-var-expansion");
			}
		});
	});

	// Tests for WSL-specific functionality
	describe("WSL-specific checks", () => {
		test("includes wsl-boundary check when in WSL", async () => {
			// Set WSL environment variable before importing
			process.env.WSL_DISTRO_NAME = "Ubuntu";

			const { PlatformChecker } = await import(
				"../../../src/domains/health-checks/platform-checker.js"
			);
			const checker = new PlatformChecker();
			const results = await checker.run();

			const checkIds = results.map((r: any) => r.id);
			expect(checkIds).toContain("wsl-boundary");
		});

		test("excludes wsl-boundary check when not in WSL", async () => {
			// Ensure no WSL environment variables
			process.env.WSL_DISTRO_NAME = undefined;
			process.env.WSLENV = undefined;

			// Force re-import by clearing the module cache
			const modulePath = "../../../src/domains/health-checks/platform-checker.js";
			delete require.cache[require.resolve(modulePath)];

			const { PlatformChecker } = await import(modulePath);
			const checker = new PlatformChecker();
			const results = await checker.run();

			const checkIds = results.map((r: any) => r.id);
			// This check should not be present unless actually in WSL
			const hasWSLCheck = checkIds.includes("wsl-boundary");
			if (!process.env.WSL_DISTRO_NAME && !process.env.WSLENV) {
				// Only assert if we're sure we're not in WSL
				const isActuallyWSL = (checker as any).isWSL();
				if (!isActuallyWSL) {
					expect(hasWSLCheck).toBe(false);
				}
			}
		});
	});

	describe("checkWSLBoundary", () => {
		test("returns appropriate status based on filesystem location", async () => {
			// Set up WSL environment
			process.env.WSL_DISTRO_NAME = "Ubuntu";

			const { PlatformChecker } = await import(
				"../../../src/domains/health-checks/platform-checker.js"
			);
			const checker = new PlatformChecker();

			const result = await (checker as any).checkWSLBoundary();

			expect(result.id).toBe("wsl-boundary");
			expect(result.name).toBe("WSL Boundary");
			expect(result.status).toBeOneOf(["pass", "warn"]);
			expect(result.autoFixable).toBe(false);
			expect(result.details).toBeDefined();

			if (result.status === "warn") {
				expect(result.message).toBe("Working in Windows filesystem from WSL");
				expect(result.suggestion).toContain("Performance may be slower");
			} else {
				expect(result.message).toBe("Working in native Linux filesystem");
				expect(result.suggestion).toBeUndefined();
			}
		});
	});

	// Additional tests for edge cases and error conditions
	describe("Edge cases", () => {
		test("handles empty environment variables gracefully", async () => {
			// Test with empty shell environment
			process.env.SHELL = "";
			process.env.ComSpec = "";

			const { PlatformChecker } = await import(
				"../../../src/domains/health-checks/platform-checker.js"
			);
			const checker = new PlatformChecker();

			const result = await (checker as any).checkShellDetection();

			expect(result.message).toBe("Unknown");
			expect(result.details).toBe("unknown");
		});

		test("handles missing global directory gracefully", async () => {
			const { PlatformChecker } = await import(
				"../../../src/domains/health-checks/platform-checker.js"
			);
			const checker = new PlatformChecker();

			// Call the method directly - it will test actual file system access
			const result = await (checker as any).checkGlobalDirAccess();

			expect(result.id).toBe("global-dir-access");
			expect(result.name).toBe("Global Dir Access");
			expect(result.priority).toBe("critical");
			// "info" is returned in CI environments without CK_TEST_HOME
			expect(["pass", "fail", "info"]).toContain(result.status);

			if (result.status === "fail") {
				expect(result.suggestion).toBeDefined();
			}
		});

		test("checkPlatformDetect includes WSL distro name when present", async () => {
			process.env.WSL_DISTRO_NAME = "Ubuntu-22.04";

			const { PlatformChecker } = await import(
				"../../../src/domains/health-checks/platform-checker.js"
			);
			const checker = new PlatformChecker();

			const result = await (checker as any).checkPlatformDetect();

			if (result.message.includes("WSL")) {
				expect(result.message).toContain("Ubuntu-22.04");
			}
		});
	});
});
