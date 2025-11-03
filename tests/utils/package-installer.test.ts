import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import {
	getPackageVersion,
	installGemini,
	installOpenCode,
	installPackageGlobally,
	isPackageInstalled,
	processPackageInstallations,
} from "../../src/utils/package-installer.js";

// Mock exec
const mockExec = mock(exec);

describe("Package Installer", () => {
	beforeEach(() => {
		mockExec.mockRestore();
	});

	describe("isPackageInstalled", () => {
		it("should return true when package is installed", async () => {
			mockExec.mockImplementation((command, callback) => {
				if (command.includes("npm list -g @opencode/cli")) {
					(callback as any)(null, { stdout: "@opencode/cli@1.0.0\n" });
				}
				return {} as any;
			});

			const result = await isPackageInstalled("@opencode/cli");
			expect(result).toBe(true);
		});

		it("should return false when package is not installed", async () => {
			mockExec.mockImplementation((command, callback) => {
				if (command.includes("npm list -g @opencode/cli")) {
					(callback as any)(new Error("Package not found"), { stderr: "empty" });
				}
				return {} as any;
			});

			const result = await isPackageInstalled("@opencode/cli");
			expect(result).toBe(false);
		});
	});

	describe("getPackageVersion", () => {
		it("should return version when package is installed", async () => {
			mockExec.mockImplementation((command, callback) => {
				if (command.includes("npm list -g @opencode/cli")) {
					(callback as any)(null, { stdout: "@opencode/cli@1.2.3\n" });
				}
				return {} as any;
			});

			const version = await getPackageVersion("@opencode/cli");
			expect(version).toBe("1.2.3");
		});

		it("should return null when package is not installed", async () => {
			mockExec.mockImplementation((command, callback) => {
				if (command.includes("npm list -g @opencode/cli")) {
					(callback as any)(new Error("Package not found"), { stderr: "empty" });
				}
				return {} as any;
			});

			const version = await getPackageVersion("@opencode/cli");
			expect(version).toBeNull();
		});
	});

	describe("installPackageGlobally", () => {
		it("should install package successfully", async () => {
			// Mock successful npm install
			mockExec
				.mockImplementationOnce((command, callback) => {
					if (command.includes("npm install -g @opencode/cli")) {
						(callback as any)(null, { stdout: "Successfully installed" });
					}
					return {} as any;
				})
				// Mock package check after installation
				.mockImplementationOnce((command, callback) => {
					if (command.includes("npm list -g @opencode/cli")) {
						(callback as any)(null, { stdout: "@opencode/cli@1.0.0\n" });
					}
					return {} as any;
				})
				// Mock version check
				.mockImplementationOnce((command, callback) => {
					if (command.includes("npm list -g @opencode/cli --depth=0")) {
						(callback as any)(null, { stdout: "@opencode/cli@1.0.0\n" });
					}
					return {} as any;
				});

			const result = await installPackageGlobally("@opencode/cli", "OpenCode CLI");

			expect(result.success).toBe(true);
			expect(result.package).toBe("OpenCode CLI");
			expect(result.version).toBe("1.0.0");
		});

		it("should handle installation failure", async () => {
			mockExec.mockImplementation((command, callback) => {
				if (command.includes("npm install -g @opencode/cli")) {
					(callback as any)(new Error("Permission denied"), { stderr: "EACCES" });
				}
				return {} as any;
			});

			const result = await installPackageGlobally("@opencode/cli", "OpenCode CLI");

			expect(result.success).toBe(false);
			expect(result.package).toBe("OpenCode CLI");
			expect(result.error).toContain("Permission denied");
		});
	});

	describe("installOpenCode and installGemini", () => {
		it("should call installPackageGlobally with correct parameters", async () => {
			const installSpy = mock((module) => module.installPackageGlobally);
			installSpy.mockResolvedValue({
				success: true,
				package: "OpenCode CLI",
				version: "1.0.0",
			});

			await installOpenCode();
			await installGemini();

			expect(installSpy).toHaveBeenCalledWith("@opencode/cli", "OpenCode CLI");
			expect(installSpy).toHaveBeenCalledWith("@google/generative-ai-cli", "Google Gemini CLI");

			installSpy.mockRestore();
		});
	});

	describe("processPackageInstallations", () => {
		it("should install both packages when requested", async () => {
			const installSpy = mock((module) => module.installPackageGlobally);
			installSpy.mockResolvedValue({
				success: true,
				package: "Test Package",
				version: "1.0.0",
			});

			const results = await processPackageInstallations(true, true);

			expect(results.opencode).toBeDefined();
			expect(results.gemini).toBeDefined();
			expect(installSpy).toHaveBeenCalledTimes(2);

			installSpy.mockRestore();
		});

		it("should skip already installed packages", async () => {
			const isInstalledSpy = mock((module) => module.isPackageInstalled);
			const getVersionSpy = mock((module) => module.getPackageVersion);

			isInstalledSpy.mockResolvedValue(true);
			getVersionSpy.mockResolvedValue("1.0.0");

			const results = await processPackageInstallations(true, true);

			expect(results.opencode?.success).toBe(true);
			expect(results.gemini?.success).toBe(true);

			isInstalledSpy.mockRestore();
			getVersionSpy.mockRestore();
		});

		it("should handle only one package installation", async () => {
			const installSpy = mock((module) => module.installPackageGlobally);
			installSpy.mockResolvedValue({
				success: true,
				package: "Test Package",
				version: "1.0.0",
			});

			const results = await processPackageInstallations(true, false);

			expect(results.opencode).toBeDefined();
			expect(results.gemini).toBeUndefined();
			expect(installSpy).toHaveBeenCalledTimes(1);

			installSpy.mockRestore();
		});
	});
});
