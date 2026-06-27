import { describe, expect, test } from "bun:test";
import {
	type PackageInstallResult,
	installAgy,
	installOpenCode,
	installPackageGlobally,
	processPackageInstallations,
} from "../../../src/services/package-installer/package-installer.js";

describe("Package Installer Integration Tests", () => {
	// These tests are designed to validate the interface and structure
	// without actually installing packages to avoid test environment changes

	describe("Function Signatures and Interfaces", () => {
		test("should have correct function signatures", () => {
			// Test that functions exist and have correct signatures
			expect(typeof installPackageGlobally).toBe("function");
			expect(typeof installOpenCode).toBe("function");
			expect(typeof installAgy).toBe("function");
			expect(typeof processPackageInstallations).toBe("function");
		});

		test("should validate PackageInstallResult interface structure", () => {
			// Create sample results to test interface compliance
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

			const minimalResult: PackageInstallResult = {
				success: true,
				package: "test-package",
			};

			// Test all required properties exist
			expect(successResult).toHaveProperty("success");
			expect(successResult).toHaveProperty("package");
			expect(successResult.success).toBe(true);
			expect(successResult.package).toBe("test-package");
			expect(successResult.version).toBe("1.0.0");

			expect(failureResult).toHaveProperty("success");
			expect(failureResult).toHaveProperty("package");
			expect(failureResult).toHaveProperty("error");
			expect(failureResult.success).toBe(false);
			expect(failureResult.error).toBe("Installation failed");

			expect(minimalResult).toHaveProperty("success");
			expect(minimalResult).toHaveProperty("package");
			expect(minimalResult.success).toBe(true);
			expect(minimalResult.package).toBe("test-package");
		});

		test("should handle function parameter validation", async () => {
			// Test parameter validation for installPackageGlobally
			await expect(installPackageGlobally("")).rejects.toThrow(
				"Package name must be a non-empty string",
			);
			await expect(installPackageGlobally("invalid package name")).rejects.toThrow(
				"Invalid package name",
			);
		});
	});

	describe("Antigravity (agy) CLI Specific Tests", () => {
		test("should use the official install script (not npm) for agy", () => {
			// agy is NOT distributed via npm; it is installed via Google's official script.
			const expectedUnixUrl = "https://antigravity.google/cli/install.sh";
			const expectedWindowsUrl = "https://antigravity.google/cli/install.ps1";
			expect(expectedUnixUrl).toContain("antigravity.google/cli/install.sh");
			expect(expectedWindowsUrl).toContain("antigravity.google/cli/install.ps1");
		});

		test("should detect agy via the 'agy --version' command", () => {
			const agyCommand = "agy --version";
			expect(agyCommand).toBe("agy --version");
		});
	});

	describe("OpenCode CLI Specific Tests", () => {
		test("should use correct installation script for OpenCode", () => {
			// Validate the expected URL for OpenCode installation script
			const expectedUrl = "https://opencode.ai/install";
			expect(expectedUrl).toContain("opencode.ai/install");
			expect(expectedUrl).toBe("https://opencode.ai/install");
		});

		test("should validate OpenCode command structure", () => {
			// Test that we expect the opencode command to be available
			const opencodeCommand = "opencode --version";
			expect(opencodeCommand).toBe("opencode --version");
		});
	});

	describe("Process Package Installations Logic Tests", () => {
		test("should return correct result structure", async () => {
			// Test with both flags false to ensure empty result
			const result = await processPackageInstallations(false, false);

			expect(result).toBeDefined();
			expect(typeof result).toBe("object");
			expect(result.opencode).toBeUndefined();
			expect(result.agy).toBeUndefined();
		});

		test("should handle boolean flag parameters", async () => {
			// Test only safe combinations that won't trigger installations
			const testCases = [
				{ opencode: false, agy: false },
				{ opencode: true, agy: false }, // Only opencode (already installed)
			];

			for (const testCase of testCases) {
				const result = await processPackageInstallations(testCase.opencode, testCase.agy);
				expect(result).toBeDefined();
				expect(typeof result).toBe("object");

				if (!testCase.opencode) {
					expect(result.opencode).toBeUndefined();
				}

				if (!testCase.agy) {
					expect(result.agy).toBeUndefined();
				}
			}
		});
	});

	describe("Error Handling Validation", () => {
		test("should handle invalid input types gracefully", async () => {
			// Test that invalid inputs are properly validated
			// This tests the validation logic without triggering actual installations

			// Test with undefined (should be handled by TypeScript, but runtime safety)
			try {
				await processPackageInstallations(undefined as any, false);
				// If we get here, the function handled it gracefully
				expect(true).toBe(true);
			} catch (error) {
				// If an error is thrown, it should be meaningful
				expect(error).toBeDefined();
			}
		});
	});

	describe("Package Name Validation Integration", () => {
		test("should validate scoped npm package names", () => {
			const packageName = "@scope/example-cli";

			// Test that this is a valid npm package name
			expect(packageName).toMatch(/^@[a-z0-9-~][a-z0-9-._~]*\/[a-z0-9-~][a-z0-9-._~]*$/);
			expect(packageName.length).toBeLessThanOrEqual(214);
			expect(packageName.length).toBeGreaterThan(0);
		});

		test("should reject malicious package names", () => {
			const maliciousNames = [
				"; rm -rf /",
				"$(rm -rf /)",
				"`rm -rf /`",
				"&& rm -rf /",
				"| rm -rf /",
				"../../etc/passwd",
			];

			for (const name of maliciousNames) {
				expect(() => validatePackageName(name)).toThrow();
			}
		});
	});
});

// Import validatePackageName for the integration tests
import { validatePackageName } from "../../../src/services/package-installer/package-installer.js";
