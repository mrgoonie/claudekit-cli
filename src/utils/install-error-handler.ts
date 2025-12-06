import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { logger } from "./logger.js";

interface InstallErrorSummary {
	exit_code: number;
	timestamp: string;
	critical_failures: string[];
	optional_failures: string[];
	skipped: string[];
	remediation: {
		sudo_packages: string;
		build_tools: string;
		pip_retry: string;
	};
}

/**
 * Parse and display rich error messages from install.sh
 * Replaces generic "Command exited with code 1" with actionable info
 */
export function displayInstallErrors(skillsDir: string): void {
	const summaryPath = join(skillsDir, ".install-error-summary.json");

	if (!existsSync(summaryPath)) {
		// Fallback to generic message if no summary file
		logger.error("Skills installation failed. Run with --verbose for details.");
		return;
	}

	try {
		const summary: InstallErrorSummary = JSON.parse(readFileSync(summaryPath, "utf-8"));

		// Display based on failure type
		if (summary.critical_failures.length > 0) {
			logger.error("");
			logger.error("━━━ Critical Failures ━━━");
			for (const failure of summary.critical_failures) {
				const [name, reason] = failure.split(":");
				logger.error(`  ✗ ${name}`);
				if (reason) logger.error(`    Reason: ${reason.trim()}`);
			}
			logger.error("");
			logger.error("These must be fixed before skills can work.");
		}

		if (summary.optional_failures.length > 0) {
			logger.warning("");
			logger.warning("━━━ Optional Package Failures ━━━");
			for (const failure of summary.optional_failures) {
				const [name, reason] = failure.split(":");
				logger.warning(`  ! ${name}`);
				if (reason) logger.info(`    Reason: ${reason.trim()}`);
			}
		}

		if (summary.skipped.length > 0) {
			logger.info("");
			logger.info("━━━ Skipped (No sudo) ━━━");
			for (const skipped of summary.skipped) {
				const [name] = skipped.split(":");
				logger.info(`  ~ ${name}`);
			}
		}

		// Show remediation commands
		logger.info("");
		logger.info("━━━ How to Fix ━━━");
		logger.info("");

		if (summary.optional_failures.some((f) => f.includes("no wheel") || f.includes("build"))) {
			logger.info("Install build tools (one-time):");
			logger.info(`  ${summary.remediation.build_tools}`);
			logger.info("");
		}

		if (summary.skipped.length > 0) {
			logger.info("Install system packages:");
			logger.info(`  ${summary.remediation.sudo_packages}`);
			logger.info("");
		}

		if (summary.optional_failures.length > 0) {
			logger.info("Then retry failed packages:");
			logger.info("  ck init --retry-failed");
			logger.info("  (or manually)");
			logger.info(`  ${summary.remediation.pip_retry}`);
		}

		// Cleanup summary file
		try {
			unlinkSync(summaryPath);
		} catch {
			// Ignore cleanup errors
		}
	} catch {
		logger.error("Skills installation failed. Run with --verbose for details.");
	}
}

/**
 * Check if system packages (FFmpeg, ImageMagick) need sudo
 * Only relevant on Linux - macOS uses brew (no sudo)
 */
export async function checkNeedsSudoPackages(): Promise<boolean> {
	// Only relevant on Linux
	if (process.platform !== "linux") {
		return false;
	}

	const { exec } = await import("node:child_process");
	const { promisify } = await import("node:util");
	const execAsync = promisify(exec);

	try {
		// Check if ffmpeg and imagemagick are missing
		await execAsync("which ffmpeg", { timeout: 3000 });
		await execAsync("which convert", { timeout: 3000 }); // imagemagick
		return false; // Both installed
	} catch {
		return true; // At least one missing
	}
}

/**
 * Check if there's an existing installation state file (for resume)
 */
export function hasInstallState(skillsDir: string): boolean {
	const stateFilePath = join(skillsDir, ".install-state.json");
	return existsSync(stateFilePath);
}
