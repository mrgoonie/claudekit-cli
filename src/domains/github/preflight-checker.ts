/**
 * Pre-flight checks for GitHub CLI before kit access detection
 * Validates gh CLI installation, version, and authentication
 */
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { logger } from "@/shared/logger.js";
import {
	GH_COMMAND_TIMEOUT_MS,
	MIN_GH_CLI_VERSION,
	compareVersions,
	getGhUpgradeInstructions,
	shouldSkipExpensiveOperations,
} from "./gh-cli-utils.js";

const execAsync = promisify(exec);

export interface PreflightResult {
	success: boolean;
	ghInstalled: boolean;
	ghVersion: string | null;
	ghVersionOk: boolean;
	ghAuthenticated: boolean;
	errorLines: string[];
}

/**
 * Create a successful preflight result (used in test/CI environments)
 */
function createSuccessfulPreflightResult(): PreflightResult {
	return {
		success: true,
		ghInstalled: true,
		ghVersion: MIN_GH_CLI_VERSION,
		ghVersionOk: true,
		ghAuthenticated: true,
		errorLines: [],
	};
}

/**
 * Check if error is a timeout error
 */
function isTimeoutError(error: unknown): boolean {
	if (error instanceof Error) {
		const msg = error.message.toLowerCase();
		return msg.includes("timeout") || msg.includes("timed out") || msg.includes("etimedout");
	}
	return false;
}

/**
 * Run pre-flight checks for GitHub CLI before attempting kit access detection
 * @returns PreflightResult with success status and error details
 */
export async function runPreflightChecks(): Promise<PreflightResult> {
	logger.debug("Running GitHub CLI pre-flight checks");

	// Early return in test/CI environments where gh may not be available
	if (process.env.NODE_ENV === "test" || shouldSkipExpensiveOperations()) {
		logger.debug("Skipping preflight checks in test/CI environment");
		return createSuccessfulPreflightResult();
	}

	const result: PreflightResult = {
		success: false,
		ghInstalled: false,
		ghVersion: null,
		ghVersionOk: false,
		ghAuthenticated: false,
		errorLines: [],
	};

	// Step 1: Check if gh is installed
	try {
		const { stdout } = await execAsync("gh --version", { timeout: GH_COMMAND_TIMEOUT_MS });
		const match = stdout.match(/(\d+\.\d+\.\d+)/);

		if (!match) {
			// gh is installed but version string is unexpected
			logger.debug(`GitHub CLI version not detected from output: ${stdout.trim()}`);
			result.ghInstalled = true;
			result.errorLines.push("✗ GitHub CLI installed but version could not be detected");
			result.errorLines.push(`  Output: ${stdout.trim().slice(0, 100)}`);
			result.errorLines.push("  Try running: gh --version");
			return result;
		}

		result.ghVersion = match[1];
		result.ghInstalled = true;
		logger.debug(`GitHub CLI detected: v${result.ghVersion}`);
	} catch (error) {
		if (isTimeoutError(error)) {
			logger.debug("GitHub CLI check timed out");
			result.errorLines.push("✗ GitHub CLI check timed out");
			result.errorLines.push("  This may indicate a slow system or network issue");
			result.errorLines.push("  Try running: gh --version");
		} else {
			logger.debug(
				`GitHub CLI not found: ${error instanceof Error ? error.message : "unknown error"}`,
			);
			result.errorLines.push("✗ GitHub CLI not installed");
			result.errorLines.push("  Install from: https://cli.github.com");
			result.errorLines.push("");
			result.errorLines.push("After install: gh auth login -h github.com");
		}
		return result;
	}

	// Step 2: Check version meets minimum requirement
	if (result.ghVersion) {
		const comparison = compareVersions(result.ghVersion, MIN_GH_CLI_VERSION);
		result.ghVersionOk = comparison >= 0;

		if (!result.ghVersionOk) {
			logger.debug(`GitHub CLI version ${result.ghVersion} is below minimum ${MIN_GH_CLI_VERSION}`);
			result.errorLines.push(...getGhUpgradeInstructions(result.ghVersion));
			return result;
		}
	}

	// Step 3: Check authentication status
	try {
		// Run gh auth status with explicit github.com host
		// Exit code 0 = authenticated, non-zero = not authenticated
		await execAsync("gh auth status -h github.com", {
			timeout: GH_COMMAND_TIMEOUT_MS,
			// Suppress update notifier which can slow down the command
			env: { ...process.env, GH_NO_UPDATE_NOTIFIER: "1" },
		});
		result.ghAuthenticated = true;
		logger.debug("GitHub CLI authenticated for github.com");
	} catch (error) {
		if (isTimeoutError(error)) {
			logger.debug("GitHub CLI auth check timed out");
			result.errorLines.push("✗ GitHub CLI auth check timed out");
			result.errorLines.push("  This may indicate a network issue");
			result.errorLines.push("  Try running: gh auth status -h github.com");
		} else {
			logger.debug(
				`GitHub CLI not authenticated: ${error instanceof Error ? error.message : "unknown error"}`,
			);
			result.errorLines.push("✗ GitHub CLI not authenticated");
			result.errorLines.push("  Run: gh auth login -h github.com");
		}
		return result;
	}

	// All checks passed
	result.success = true;
	logger.debug("All GitHub CLI pre-flight checks passed");
	return result;
}
