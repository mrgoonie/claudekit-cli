import { describe, expect, it } from "bun:test";
import {
	type PackageInstallResult,
	getPackageVersion,
	installGemini,
	installOpenCode,
	installPackageGlobally,
	isPackageInstalled,
	processPackageInstallations,
	validatePackageName,
} from "@/services/package-installer/package-installer.js";

describe("Package Installer", () => {
	describe("PackageInstallResult interface", () => {
		it("should accept valid PackageInstallResult objects", () => {
			const successResult: PackageInstallResult = {
				success: true,
				package: "Test Package",
				version: "1.0.0",
			};

			const failureResult: PackageInstallResult = {
				success: false,
				package: "Test Package",
				error: "Installation failed",
			};

			expect(successResult.success).toBe(true);
			expect(failureResult.success).toBe(false);
		});
	});

	describe("processPackageInstallations", () => {
		it("should handle false values for both packages", async () => {
			const results = await processPackageInstallations(false, false);

			expect(results.opencode).toBeUndefined();
			expect(results.gemini).toBeUndefined();
		});
	});

	// Skip network-dependent tests in CI to avoid timeouts
	describe.skip("Network dependent tests", () => {
		it("should handle installation failure gracefully", async () => {
			// Test with a non-existent package to ensure graceful failure
			const result = await installPackageGlobally("@non-existent/test-package", "Test Package");

			expect(result.success).toBe(false);
			expect(result.package).toBe("Test Package");
			expect(result.error).toBeDefined();
		});

		it("should return proper result structure for OpenCode", async () => {
			const result = await installOpenCode();

			expect(result).toHaveProperty("success");
			expect(result).toHaveProperty("package");
			expect(result.package).toBe("OpenCode CLI");
		});

		it("should return proper result structure for Gemini", async () => {
			const result = await installGemini();

			expect(result).toHaveProperty("success");
			expect(result).toHaveProperty("package");
			expect(result.package).toBe("Google Gemini CLI");
		});

		it("should attempt installation when requested", async () => {
			const results = await processPackageInstallations(true, true);

			// Results should be defined (even if installation fails)
			expect(results).toHaveProperty("opencode");
			expect(results).toHaveProperty("gemini");

			// Each result should have the expected structure
			if (results.opencode) {
				expect(results.opencode).toHaveProperty("success");
				expect(results.opencode).toHaveProperty("package");
			}

			if (results.gemini) {
				expect(results.gemini).toHaveProperty("success");
				expect(results.gemini).toHaveProperty("package");
			}
		});

		it("should handle only OpenCode installation", async () => {
			const results = await processPackageInstallations(true, false);

			expect(results.opencode).toBeDefined();
			expect(results.gemini).toBeUndefined();
		});

		it("should handle only Gemini installation", async () => {
			const results = await processPackageInstallations(false, true);

			expect(results.opencode).toBeUndefined();
			expect(results.gemini).toBeDefined();
		});
	});

	describe("Security Tests", () => {
		it("should reject malicious package names with command injection attempts", async () => {
			const maliciousPackages = [
				"@evil/pkg; rm -rf /",
				"package; cat /etc/passwd",
				"package && echo 'hacked'",
				"package|whoami",
				"package`whoami`",
				"$(whoami)/package",
				"", // empty string
				".", // single dot
				"..", // double dot
			];

			for (const maliciousPackage of maliciousPackages) {
				await expect(isPackageInstalled(maliciousPackage)).rejects.toThrow();
				await expect(getPackageVersion(maliciousPackage)).rejects.toThrow();
				await expect(installPackageGlobally(maliciousPackage)).rejects.toThrow();
			}
		});

		it("should reject package names that are too long", async () => {
			const longPackageName = "a".repeat(215); // 215 chars, over the 214 limit

			await expect(isPackageInstalled(longPackageName)).rejects.toThrow("Package name too long");
			await expect(getPackageVersion(longPackageName)).rejects.toThrow("Package name too long");
			await expect(installPackageGlobally(longPackageName)).rejects.toThrow(
				"Package name too long",
			);
		});

		it("should accept valid npm package names", async () => {
			const validPackages = [
				"lodash",
				"@opencode/cli",
				"@google-ai/generative-ai-cli",
				"react",
				"express",
				"typescript",
			];

			// Test validation directly without making network calls
			// These should not throw validation errors
			for (const validPackage of validPackages) {
				expect(() => {
					validatePackageName(validPackage);
				}).not.toThrow();
			}
		});
	});
});
