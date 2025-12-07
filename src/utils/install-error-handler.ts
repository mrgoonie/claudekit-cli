import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { logger } from "./logger.js";

// Timeout for shell commands like 'which' - 3s is generous for local filesystem checks
const WHICH_COMMAND_TIMEOUT_MS = 3000;

export interface InstallErrorSummary {
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
 * Parse "name: reason" strings safely, handling multiple colons
 * e.g., "pip: error: package not found" → ["pip", "error: package not found"]
 */
function parseNameReason(str: string): [string, string | undefined] {
	const colonIndex = str.indexOf(":");
	if (colonIndex === -1) {
		return [str.trim(), undefined];
	}
	return [str.slice(0, colonIndex).trim(), str.slice(colonIndex + 1).trim()];
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

	let summary: InstallErrorSummary;
	try {
		summary = JSON.parse(readFileSync(summaryPath, "utf-8"));
	} catch (parseError) {
		// JSON is malformed (corrupt file, partial write)
		logger.error("Failed to parse error summary. File may be corrupted.");
		logger.debug(
			`Parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
		);
		return;
	}

	try {
		// Display based on failure type
		if (summary.critical_failures.length > 0) {
			logger.error("");
			logger.error("━━━ Critical Failures ━━━");
			for (const failure of summary.critical_failures) {
				const [name, reason] = parseNameReason(failure);
				logger.error(`  ✗ ${name}`);
				if (reason) logger.error(`    Reason: ${reason}`);
			}
			logger.error("");
			logger.error("These must be fixed before skills can work.");
		}

		if (summary.optional_failures.length > 0) {
			logger.warning("");
			logger.warning("━━━ Optional Package Failures ━━━");
			for (const failure of summary.optional_failures) {
				const [name, reason] = parseNameReason(failure);
				logger.warning(`  ! ${name}`);
				if (reason) logger.info(`    Reason: ${reason}`);
			}
		}

		if (summary.skipped.length > 0) {
			logger.info("");
			logger.info("━━━ Skipped (No sudo) ━━━");
			for (const skipped of summary.skipped) {
				const [name] = parseNameReason(skipped);
				logger.info(`  ~ ${name}`);
			}
		}

		// Show remediation commands
		logger.info("");
		logger.info("━━━ How to Fix ━━━");
		logger.info("");

		// Check for build tool related failures (more specific patterns to avoid false matches)
		if (
			summary.optional_failures.some(
				(f) => f.includes("no wheel") || f.includes("build tools") || f.includes("build failed"),
			) &&
			summary.remediation.build_tools
		) {
			logger.info("Install build tools (one-time):");
			logger.info(`  ${summary.remediation.build_tools}`);
			logger.info("");
		}

		if (summary.skipped.length > 0 && summary.remediation.sudo_packages) {
			logger.info("Install system packages:");
			logger.info(`  ${summary.remediation.sudo_packages}`);
			logger.info("");
		}

		if (summary.optional_failures.length > 0 && summary.remediation.pip_retry) {
			logger.info("Then retry failed packages manually:");
			logger.info(`  ${summary.remediation.pip_retry}`);
		}

		// Cleanup summary file after displaying errors
		try {
			unlinkSync(summaryPath);
		} catch (cleanupError) {
			logger.debug(
				`Failed to cleanup summary file: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
			);
		}
	} catch (displayError) {
		logger.error("Failed to display error summary.");
		logger.debug(
			`Display error: ${displayError instanceof Error ? displayError.message : String(displayError)}`,
		);
	}
}

/**
 * Check if system packages (FFmpeg, ImageMagick) need sudo
 * Only relevant on Linux with apt-get (Debian/Ubuntu derivatives)
 * Note: WSL reports as "linux" but may not have apt-get. Alpine uses apk.
 * macOS uses brew which doesn't require sudo.
 */
export async function checkNeedsSudoPackages(): Promise<boolean> {
	// Only relevant on Linux - macOS uses brew (no sudo needed)
	if (process.platform !== "linux") {
		return false;
	}

	const { exec } = await import("node:child_process");
	const { promisify } = await import("node:util");
	const execAsync = promisify(exec);

	try {
		// Check if ffmpeg and imagemagick are missing (run in parallel)
		await Promise.all([
			execAsync("which ffmpeg", { timeout: WHICH_COMMAND_TIMEOUT_MS }),
			execAsync("which convert", { timeout: WHICH_COMMAND_TIMEOUT_MS }), // imagemagick
		]);
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
