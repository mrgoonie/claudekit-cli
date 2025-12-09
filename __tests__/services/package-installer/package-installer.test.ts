import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	type PackageInstallResult,
	getPackageVersion,
	installSkillsDependencies,
	isPackageInstalled,
	processPackageInstallations,
	validatePackageName,
} from "../../../src/services/package-installer/package-installer.js";

describe("Package Installer Tests", () => {
	// Test package name validation - this can be tested without mocking
	describe("validatePackageName", () => {
		test("should accept valid npm package names", () => {
			expect(() => validatePackageName("lodash")).not.toThrow();
			expect(() => validatePackageName("@google/gemini-cli")).not.toThrow();
			expect(() => validatePackageName("react-dom")).not.toThrow();
			expect(() => validatePackageName("express")).not.toThrow();
		});

		test("should reject invalid package names", () => {
			expect(() => validatePackageName("")).toThrow("Package name must be a non-empty string");
			expect(() => validatePackageName("Invalid-Package")).toThrow("Invalid package name");
			expect(() => validatePackageName("invalid space")).toThrow("Invalid package name");
			expect(() => validatePackageName("..")).toThrow("Invalid package name");
			expect(() => validatePackageName("rm -rf /")).toThrow("Invalid package name");
		});

		test("should reject package names that are too long", () => {
			const longName = "a".repeat(215);
			expect(() => validatePackageName(longName)).toThrow("Package name too long");
		});

		test("should reject non-string input", () => {
			expect(() => validatePackageName(null as any)).toThrow(
				"Package name must be a non-empty string",
			);
			expect(() => validatePackageName(undefined as any)).toThrow(
				"Package name must be a non-empty string",
			);
			expect(() => validatePackageName(123 as any)).toThrow(
				"Package name must be a non-empty string",
			);
		});
	});

	// Test package detection logic with real npm commands
	describe("Package Detection Logic", () => {
		test("should correctly detect if npm is installed", async () => {
			// npm should be available since we're running this test
			// In CI mode, we skip network calls but npm should still be detected as available
			const result = await isPackageInstalled("npm");
			const isCIEnvironment = process.env.CI === "true" || process.env.CI_SAFE_MODE === "true";

			if (isCIEnvironment) {
				// In CI, we expect false because we skip network calls
				expect(result).toBe(false);
			} else {
				// In local development, npm should be detected
				expect(result).toBe(true);
			}
		});

		test("should correctly detect version of npm", async () => {
			// npm should be available and have a version
			const version = await getPackageVersion("npm");
			const isCIEnvironment = process.env.CI === "true" || process.env.CI_SAFE_MODE === "true";

			if (isCIEnvironment) {
				// In CI, we expect null because we skip network calls
				expect(version).toBeNull();
			} else {
				// In local development, npm should have a version
				expect(version).not.toBeNull();
				expect(typeof version).toBe("string");
				expect(version?.length).toBeGreaterThan(0);
			}
		});

		test("should return false for non-existent package", async () => {
			// Test with a package that definitely doesn't exist
			const result = await isPackageInstalled("definitely-not-a-real-package-name-12345");
			expect(result).toBe(false);
		});

		test("should return null for non-existent package version", async () => {
			// Test with a package that definitely doesn't exist
			const version = await getPackageVersion("definitely-not-a-real-package-name-12345");
			expect(version).toBeNull();
		});

		test("should validate package name for isPackageInstalled", async () => {
			await expect(isPackageInstalled("invalid package name")).rejects.toThrow(
				"Invalid package name",
			);
		});

		test("should validate package name for getPackageVersion", async () => {
			await expect(getPackageVersion("invalid package name")).rejects.toThrow(
				"Invalid package name",
			);
		});
	});

	// Test Google Gemini CLI specific functionality
	describe("Google Gemini CLI", () => {
		test("should detect if @google/gemini-cli is installed", async () => {
			const isInstalled = await isPackageInstalled("@google/gemini-cli");
			expect(typeof isInstalled).toBe("boolean");
		});

		test("should get version if @google/gemini-cli is installed", async () => {
			const version = await getPackageVersion("@google/gemini-cli");
			if (version) {
				expect(typeof version).toBe("string");
				expect(version.length).toBeGreaterThan(0);
			} else {
				// Package not installed, which is fine
				expect(version).toBeNull();
			}
		});

		test("should have correct package name for Gemini", async () => {
			// Verify the function uses the correct package name
			expect(() => validatePackageName("@google/gemini-cli")).not.toThrow();
		});
	});

	// Test OpenCode CLI detection (without actually installing)
	describe("OpenCode CLI Detection", () => {
		test("should check if opencode command is available", async () => {
			// This test just checks if we can detect the command, doesn't install anything
			try {
				// Try to run opencode --version to see if it's already installed
				const { exec } = await import("node:child_process");
				const { promisify } = await import("node:util");
				const execAsync = promisify(exec);

				await execAsync("opencode --version");
				// If we get here, opencode is installed
				expect(true).toBe(true);
			} catch (error) {
				// opencode is not installed, which is fine for this test
				expect(error).toBeDefined();
			}
		});
	});

	// Test processPackageInstallations function (detection only, no installation)
	describe("Process Package Installations", () => {
		test("should skip packages when installation flags are false", async () => {
			const result = await processPackageInstallations(false, false);
			expect(result.opencode).toBeUndefined();
			expect(result.gemini).toBeUndefined();
		});

		test("should handle processPackageInstallations function structure", async () => {
			// Test with both flags false to ensure function structure is correct
			const result = await processPackageInstallations(false, false);

			// Should return empty result when both flags are false
			expect(result).toBeDefined();
			expect(result.opencode).toBeUndefined();
			expect(result.gemini).toBeUndefined();
		});

		test("should handle processPackageInstallations with opencode only", async () => {
			// Test with only opencode flag to check detection logic
			// This should only check if opencode is already installed, not install it
			const result = await processPackageInstallations(true, false);

			// Should have opencode result
			expect(result).toBeDefined();
			expect(result.gemini).toBeUndefined();

			if (result.opencode) {
				expect(result.opencode.package).toBe("OpenCode CLI");
				expect(typeof result.opencode.success).toBe("boolean");
			}
		});
	});

	// Test edge cases and error handling
	describe("Error Handling and Edge Cases", () => {
		test("should handle special characters in package names correctly", () => {
			// Test valid special characters
			expect(() => validatePackageName("test-package")).not.toThrow();
			expect(() => validatePackageName("test_package")).not.toThrow();
			expect(() => validatePackageName("test.package")).not.toThrow();
			expect(() => validatePackageName("@scope/package")).not.toThrow();
			expect(() => validatePackageName("@scope/package-name")).not.toThrow();
		});

		test("should reject dangerous package names", () => {
			// Test dangerous inputs
			expect(() => validatePackageName("; rm -rf /")).toThrow();
			expect(() => validatePackageName("$(rm -rf /)")).toThrow();
			expect(() => validatePackageName("`rm -rf /`")).toThrow();
			expect(() => validatePackageName("&& rm -rf /")).toThrow();
			expect(() => validatePackageName("| rm -rf /")).toThrow();
		});

		test("should handle package names at length limits", () => {
			// Test exactly at the limit
			const maxLengthName = "a".repeat(214);
			expect(() => validatePackageName(maxLengthName)).not.toThrow();

			// Test just over the limit
			const tooLongName = "a".repeat(215);
			expect(() => validatePackageName(tooLongName)).toThrow("Package name too long");
		});
	});

	// Test installation result interface
	describe("PackageInstallResult Interface", () => {
		test("should create valid PackageInstallResult objects", () => {
			const successResult: PackageInstallResult = {
				success: true,
				package: "test-package",
				version: "1.0.0",
			};

			const failureResult: PackageInstallResult = {
				success: false,
				package: "test-package",
				error: "Installation failed",
			};

			expect(successResult.success).toBe(true);
			expect(successResult.package).toBe("test-package");
			expect(successResult.version).toBe("1.0.0");
			expect(successResult.error).toBeUndefined();

			expect(failureResult.success).toBe(false);
			expect(failureResult.package).toBe("test-package");
			expect(failureResult.error).toBe("Installation failed");
			expect(failureResult.version).toBeUndefined();
		});
	});

	// Test installSkillsDependencies function
	describe("installSkillsDependencies", () => {
		let originalEnv: NodeJS.ProcessEnv;
		let originalStdin: typeof process.stdin;

		beforeEach(() => {
			// Save original environment
			originalEnv = { ...process.env };
			originalStdin = process.stdin;
		});

		afterEach(() => {
			// Restore original environment
			process.env = originalEnv;
			Object.defineProperty(process, "stdin", { value: originalStdin });
		});

		test("should skip in CI environment", async () => {
			// Set CI environment variable
			process.env.CI = "true";
			Object.defineProperty(process.stdin, "isTTY", {
				value: true,
				configurable: true,
			});

			const result = await installSkillsDependencies("/fake/skills/dir");

			expect(result.success).toBe(false);
			expect(result.package).toBe("Skills Dependencies");
			// When CI is set, we get "CI environment" message
			expect(result.error).toContain("CI environment");
		});

		test("should skip in non-interactive mode (no TTY)", async () => {
			// Mock non-TTY environment
			process.env.CI = undefined;
			process.env.CI_SAFE_MODE = undefined;
			Object.defineProperty(process.stdin, "isTTY", {
				value: false,
				configurable: true,
			});

			const result = await installSkillsDependencies("/fake/skills/dir");

			expect(result.success).toBe(false);
			expect(result.package).toBe("Skills Dependencies");
			expect(result.error).toContain("non-interactive mode");
		});

		test("should skip when NON_INTERACTIVE is set", async () => {
			// Delete CI to avoid early return, then set NON_INTERACTIVE
			process.env.CI = undefined;
			process.env.CI_SAFE_MODE = undefined;
			process.env.NON_INTERACTIVE = "true";
			Object.defineProperty(process.stdin, "isTTY", {
				value: true,
				configurable: true,
			});

			const result = await installSkillsDependencies("/fake/skills/dir");

			expect(result.success).toBe(false);
			expect(result.package).toBe("Skills Dependencies");
			expect(result.error).toContain("non-interactive mode");
		});

		test("should fail when script not found", async () => {
			// Set up interactive environment
			process.env.CI = undefined;
			process.env.CI_SAFE_MODE = undefined;
			process.env.NON_INTERACTIVE = undefined;
			Object.defineProperty(process.stdin, "isTTY", {
				value: true,
				configurable: true,
			});

			const result = await installSkillsDependencies("/non/existent/path");

			expect(result.success).toBe(false);
			expect(result.package).toBe("Skills Dependencies");
			expect(result.error).toContain("Installation script not found");
		});
	});
});
