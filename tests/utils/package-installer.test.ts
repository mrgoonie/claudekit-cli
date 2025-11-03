import { describe, expect, it } from "bun:test";
import {
	getPackageVersion,
	installGemini,
	installOpenCode,
	installPackageGlobally,
	isPackageInstalled,
	processPackageInstallations,
	type PackageInstallResult,
} from "../../src/utils/package-installer.js";

describe("Package Installer", () => {
	describe("installPackageGlobally", () => {
		it("should handle installation failure gracefully", async () => {
			// Test with a non-existent package to ensure graceful failure
			const result = await installPackageGlobally("@non-existent/test-package", "Test Package");

			expect(result.success).toBe(false);
			expect(result.package).toBe("Test Package");
			expect(result.error).toBeDefined();
		});
	});

	describe("installOpenCode and installGemini", () => {
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
	});

	describe("processPackageInstallations", () => {
		it("should handle false values for both packages", async () => {
			const results = await processPackageInstallations(false, false);

			expect(results.opencode).toBeUndefined();
			expect(results.gemini).toBeUndefined();
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
});