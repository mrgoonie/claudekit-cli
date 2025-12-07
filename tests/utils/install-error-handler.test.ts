import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type InstallErrorSummary,
	checkNeedsSudoPackages,
	displayInstallErrors,
	hasInstallState,
} from "../../src/utils/install-error-handler.js";
import { logger } from "../../src/utils/logger.js";

describe("install-error-handler", () => {
	let testDir: string;
	let loggerErrorSpy: ReturnType<typeof spyOn>;
	let loggerWarningSpy: ReturnType<typeof spyOn>;
	let loggerInfoSpy: ReturnType<typeof spyOn>;
	let loggerDebugSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		// Create temp test directory
		testDir = join(tmpdir(), `install-error-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });

		// Spy on logger methods
		loggerErrorSpy = spyOn(logger, "error").mockImplementation(() => {});
		loggerWarningSpy = spyOn(logger, "warning").mockImplementation(() => {});
		loggerInfoSpy = spyOn(logger, "info").mockImplementation(() => {});
		loggerDebugSpy = spyOn(logger, "debug").mockImplementation(() => {});
	});

	afterEach(() => {
		// Cleanup test directory
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}

		// Restore spies
		loggerErrorSpy.mockRestore();
		loggerWarningSpy.mockRestore();
		loggerInfoSpy.mockRestore();
		loggerDebugSpy.mockRestore();
	});

	describe("displayInstallErrors", () => {
		it("should handle missing summary file gracefully", () => {
			displayInstallErrors(testDir);

			expect(loggerErrorSpy).toHaveBeenCalledWith(
				"Skills installation failed. Run with --verbose for details.",
			);
		});

		it("should display critical failures correctly", () => {
			const summary: InstallErrorSummary = {
				exit_code: 1,
				timestamp: new Date().toISOString(),
				critical_failures: ["Python: not installed"],
				optional_failures: [],
				skipped: [],
				remediation: {
					sudo_packages: "sudo apt-get install -y ffmpeg",
					build_tools: "sudo apt-get install -y gcc",
					pip_retry: "pip install <package>",
				},
			};

			writeFileSync(join(testDir, ".install-error-summary.json"), JSON.stringify(summary));
			displayInstallErrors(testDir);

			expect(loggerErrorSpy).toHaveBeenCalledWith("━━━ Critical Failures ━━━");
			expect(loggerErrorSpy).toHaveBeenCalledWith("  ✗ Python");
			expect(loggerErrorSpy).toHaveBeenCalledWith("    Reason: not installed");
		});

		it("should display optional failures with warnings", () => {
			const summary: InstallErrorSummary = {
				exit_code: 2,
				timestamp: new Date().toISOString(),
				critical_failures: [],
				optional_failures: ["ai-multimodal:google-genai: Package install failed"],
				skipped: [],
				remediation: {
					sudo_packages: "",
					build_tools: "",
					pip_retry: "pip install google-genai",
				},
			};

			writeFileSync(join(testDir, ".install-error-summary.json"), JSON.stringify(summary));
			displayInstallErrors(testDir);

			expect(loggerWarningSpy).toHaveBeenCalledWith("━━━ Optional Package Failures ━━━");
			expect(loggerWarningSpy).toHaveBeenCalledWith("  ! ai-multimodal");
		});

		it("should display skipped packages", () => {
			const summary: InstallErrorSummary = {
				exit_code: 0,
				timestamp: new Date().toISOString(),
				critical_failures: [],
				optional_failures: [],
				skipped: ["FFmpeg: requires sudo", "ImageMagick: requires sudo"],
				remediation: {
					sudo_packages: "sudo apt-get install -y ffmpeg imagemagick",
					build_tools: "",
					pip_retry: "",
				},
			};

			writeFileSync(join(testDir, ".install-error-summary.json"), JSON.stringify(summary));
			displayInstallErrors(testDir);

			expect(loggerInfoSpy).toHaveBeenCalledWith("━━━ Skipped (No sudo) ━━━");
			expect(loggerInfoSpy).toHaveBeenCalledWith("  ~ FFmpeg");
			expect(loggerInfoSpy).toHaveBeenCalledWith("  ~ ImageMagick");
		});

		it("should show remediation commands", () => {
			const summary: InstallErrorSummary = {
				exit_code: 2,
				timestamp: new Date().toISOString(),
				critical_failures: [],
				optional_failures: ["skill:pkg: no wheel available"],
				skipped: ["FFmpeg: requires sudo"],
				remediation: {
					sudo_packages: "sudo apt-get install -y ffmpeg",
					build_tools: "sudo apt-get install -y gcc python3-dev",
					pip_retry: "pip install pkg",
				},
			};

			writeFileSync(join(testDir, ".install-error-summary.json"), JSON.stringify(summary));
			displayInstallErrors(testDir);

			expect(loggerInfoSpy).toHaveBeenCalledWith("━━━ How to Fix ━━━");
			expect(loggerInfoSpy).toHaveBeenCalledWith("  sudo apt-get install -y ffmpeg");
		});

		it("should handle malformed JSON gracefully", () => {
			writeFileSync(join(testDir, ".install-error-summary.json"), "{ invalid json }");
			displayInstallErrors(testDir);

			expect(loggerErrorSpy).toHaveBeenCalledWith(
				"Failed to parse error summary. File may be corrupted.",
			);
			expect(loggerDebugSpy).toHaveBeenCalled();
		});

		it("should cleanup summary file after reading", () => {
			const summary: InstallErrorSummary = {
				exit_code: 0,
				timestamp: new Date().toISOString(),
				critical_failures: [],
				optional_failures: [],
				skipped: [],
				remediation: {
					sudo_packages: "",
					build_tools: "",
					pip_retry: "",
				},
			};

			const summaryPath = join(testDir, ".install-error-summary.json");
			writeFileSync(summaryPath, JSON.stringify(summary));

			expect(existsSync(summaryPath)).toBe(true);
			displayInstallErrors(testDir);
			expect(existsSync(summaryPath)).toBe(false);
		});

		it("should handle strings with multiple colons correctly", () => {
			const summary: InstallErrorSummary = {
				exit_code: 1,
				timestamp: new Date().toISOString(),
				critical_failures: ["pip: error: network timeout: connection refused"],
				optional_failures: [],
				skipped: [],
				remediation: {
					sudo_packages: "",
					build_tools: "",
					pip_retry: "",
				},
			};

			writeFileSync(join(testDir, ".install-error-summary.json"), JSON.stringify(summary));
			displayInstallErrors(testDir);

			// Should show "pip" as name and the rest as reason
			expect(loggerErrorSpy).toHaveBeenCalledWith("  ✗ pip");
			expect(loggerErrorSpy).toHaveBeenCalledWith(
				"    Reason: error: network timeout: connection refused",
			);
		});

		it("should handle empty remediation commands gracefully", () => {
			const summary: InstallErrorSummary = {
				exit_code: 2,
				timestamp: new Date().toISOString(),
				critical_failures: [],
				optional_failures: ["pkg: failed"],
				skipped: [],
				remediation: {
					sudo_packages: "", // empty
					build_tools: "", // empty
					pip_retry: "", // empty
				},
			};

			writeFileSync(join(testDir, ".install-error-summary.json"), JSON.stringify(summary));
			displayInstallErrors(testDir);

			// Should not crash and should display the failure
			expect(loggerWarningSpy).toHaveBeenCalledWith("━━━ Optional Package Failures ━━━");
			expect(loggerWarningSpy).toHaveBeenCalledWith("  ! pkg");
		});
	});

	describe("checkNeedsSudoPackages", () => {
		it("should return false on non-Linux platforms", async () => {
			// This test will behave differently based on actual platform
			// On non-Linux, should always return false
			if (process.platform !== "linux") {
				const result = await checkNeedsSudoPackages();
				expect(result).toBe(false);
			}
		});

		it("should handle timeout gracefully", async () => {
			// On any platform, should not throw
			const result = await checkNeedsSudoPackages();
			expect(typeof result).toBe("boolean");
		});
	});

	describe("hasInstallState", () => {
		it("should return true when state file exists", () => {
			writeFileSync(join(testDir, ".install-state.json"), "{}");
			expect(hasInstallState(testDir)).toBe(true);
		});

		it("should return false when state file missing", () => {
			expect(hasInstallState(testDir)).toBe(false);
		});
	});
});
